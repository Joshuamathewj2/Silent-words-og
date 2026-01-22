import numpy as np
import cv2
import os
import sys
import operator
from string import ascii_uppercase
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64

# Optional imports with graceful degradation
try:
    from hunspell import Hunspell
except ImportError:
    print("Warning: Hunspell not found. Suggestions will be disabled.")
    Hunspell = None

try:
    from keras.models import model_from_json
except ImportError:
    try:
        from tensorflow.keras.models import model_from_json
    except ImportError:
        print("Critical Error: Keras/Tensorflow not found. Please install tensorflow.")
        model_from_json = None

# Initialize Flask App
app = Flask(__name__)
CORS(app)

class SignLanguageSystem:
    def __init__(self):
        print("Loading models...")
        self.hs = Hunspell('en_US') if Hunspell else None
        self.loaded_model = None
        self.loaded_model_dru = None
        self.loaded_model_tkdi = None
        self.loaded_model_smn = None
        
        # 1. Temporal & UX State
        self.current_word = ""
        self.last_prediction = "blank"
        self.LOCK_THRESHOLD = 50 # Required 50 frames
        self.already_locked = False 

        if model_from_json:
            try:
                # Load Main Model
                with open("Models/model_new.json", "r") as json_file:
                    model_json = json_file.read()
                self.loaded_model = model_from_json(model_json)
                self.loaded_model.load_weights("Models/model_new.h5")
                print(f"Main Model Loaded. Output Shape: {self.loaded_model.output_shape}")

                # Load Hierarchical Models
                self.loaded_model_dru = self._load_model("Models/model-bw_dru.json", "Models/model-bw_dru.h5")
                self.loaded_model_tkdi = self._load_model("Models/model-bw_tkdi.json", "Models/model-bw_tkdi.h5")
                self.loaded_model_smn = self._load_model("Models/model-bw_smn.json", "Models/model-bw_smn.h5")
                
                print("All models loaded successfully.")
            except Exception as e:
                print(f"CRITICAL ERROR loading models: {e}")
                raise e
        else:
            raise ImportError("Keras/Tensorflow missing")

    def _load_model(self, json_path, h5_path):
        with open(json_path, "r") as f:
            model = model_from_json(f.read())
        model.load_weights(h5_path)
        return model

    def reset_state(self):
        self.current_word = ""
        self.last_prediction = "blank"
        self.stable_frame_count = 0
        self.already_locked = False

    def process_frame(self, image_data_base64):
        if not image_data_base64:
            return {"error": "No image data", "confidence": 0}

        try:
            if "base64," in image_data_base64:
                image_data_base64 = image_data_base64.split("base64,")[1]
            img_bytes = base64.b64decode(image_data_base64)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if frame is None: return None
        except Exception as e:
            print(f"Error decoding image: {e}")
            return None

        # Preprocessing (already validated in previous steps)
        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape
        roi_w, roi_h = 515, 289
        y1 = max(0, (h - roi_h) // 2)
        x1 = max(0, (w - roi_w) // 2)
        roi = frame[y1:y1+roi_h, x1:x1+roi_w]
        
        if roi.size == 0:
            return self._handle_prediction("blank")

        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (3, 3), 0) # Reduced blur to preserve edges
        
        # Binary Threshold - Goal: Black Hand on White Background
        th3 = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
        
        # Second Threshold to ensure Black Hand on White Background (matching training data)
        # The training data collection uses THRESH_BINARY_INV + THRESH_OTSU on top of adaptive threshold
        ret, th3 = cv2.threshold(th3, 70, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Removed dilation as it would now thicken the silhouette border or thin the white background
        # kernel = np.ones((3, 3), np.uint8)
        # th3 = cv2.dilate(th3, kernel, iterations=1)
        
        # Optional: Morphological Opening to remove small noise dots if any
        kernel = np.ones((3, 3), np.uint8)
        th3 = cv2.morphologyEx(th3, cv2.MORPH_OPEN, kernel)

        # Contour validation: return blank if no significant hand is found
        contours, _ = cv2.findContours(th3, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours or max(cv2.contourArea(c) for c in contours) < 2500:
            return self._handle_prediction("blank")

        # Resize to 128x128 and ensure strictly binary (0 or 255)
        test_image = cv2.resize(th3, (128, 128))
        _, test_image = cv2.threshold(test_image, 127, 255, cv2.THRESH_BINARY)
        cv2.imwrite("DEBUG_THRESH.png", test_image)
        
        input_data = test_image.astype('float32') / 255.0
        input_data = input_data.reshape(1, 128, 128, 1)

        # CNN Prediction
        result = self.loaded_model.predict(input_data)
        prediction_map = {'blank': result[0][0]}
        for i, char in enumerate(ascii_uppercase):
            prediction_map[char] = result[0][i+1]
            
        sorted_preds = sorted(prediction_map.items(), key=operator.itemgetter(1), reverse=True)
        top_symbol = sorted_preds[0][0]
        
        # Hierarchical Refinement
        final_symbol = top_symbol
        if top_symbol in ['D', 'R', 'U']:
            res = self.loaded_model_dru.predict(input_data)
            final_symbol = ['D', 'R', 'U'][np.argmax(res[0])]
        elif top_symbol in ['D', 'I', 'K', 'T']:
            res = self.loaded_model_tkdi.predict(input_data)
            final_symbol = ['D', 'I', 'K', 'T'][np.argmax(res[0])]
        elif top_symbol in ['M', 'N', 'S']:
            res = self.loaded_model_smn.predict(input_data)
            final_symbol = ['M', 'N', 'S'][np.argmax(res[0])]

        return self._handle_prediction(final_symbol)

    def _handle_prediction(self, current_prediction):
        # 2. Letter Lock & Stability Logic
        if current_prediction == self.last_prediction:
            if not self.already_locked:
                self.stable_frame_count += 1
        else:
            # Different letter appears, reset counter
            self.last_prediction = current_prediction
            self.stable_frame_count = 1
            self.already_locked = False

        # 1. Confidence = (stable_frames / 50) * 100
        temporal_confidence = min(100.0, (self.stable_frame_count / self.LOCK_THRESHOLD) * 100.0)

        # 3. Commit/Lock Mechanism
        if self.stable_frame_count >= self.LOCK_THRESHOLD and not self.already_locked:
            if current_prediction == "blank":
                if self.current_word and not self.current_word.endswith(" "):
                    self.current_word += " " # Space separator
            else:
                self.current_word += current_prediction # Append letter
            
            print(f"[LOCK] Committed '{current_prediction}'. Current Word: {self.current_word}")
            self.already_locked = True 

        # 6. Response Format
        return {
            "prediction": current_prediction,
            "confidence": float(temporal_confidence),
            "word": self.current_word,
            "character": current_prediction, # Fallback
            "sentence": "" # Placeholder
        }

system = SignLanguageSystem()

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    if not data or 'image' not in data:
        return jsonify({"error": "No image data"}), 400
    
    result = system.process_frame(data['image'])
    if result:
        return jsonify(result), 200
    return jsonify({"error": "Processing failed"}), 500

@app.route('/reset', methods=['POST'])
def reset():
    system.reset_state()
    return jsonify({"status": "Reset complete"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

