import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { StopCircle, RotateCcw, Video, Hand, Activity, CheckCircle2 } from "lucide-react";
import { toGrayscale, boxBlur, adaptiveThreshold, removeNoise, fillGaps, keepLargestContour, centerContent, fillHoles, erode } from "../utils/imageProcessing";

interface CameraRecognitionProps {
  onStop: () => void;
}

export function CameraRecognition({ onStop }: CameraRecognitionProps) {
  const [detectedText, setDetectedText] = useState<string[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(true);
  const [confidence, setConfidence] = useState(0);
  const [currentWord, setCurrentWord] = useState("");
  const [combinedSentence, setCombinedSentence] = useState("");

  const videoRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Camera handling
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
          }
        });

        if (videoElementRef.current) {
          videoElementRef.current.srcObject = stream;
          videoElementRef.current.play();
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setIsRecognizing(false);
      }
    };

    if (isRecognizing) {
      startCamera();
    } else {
      if (videoElementRef.current?.srcObject) {
        const tracks = (videoElementRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoElementRef.current.srcObject = null;
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isRecognizing]);

  // Prediction Loop
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const processFrame = async () => {
      if (!isRecognizing || !videoElementRef.current || !canvasRef.current) return;

      const video = videoElementRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        // ROI Extraction Logic
        const roiSize = 300; // Matches visually displayed box size
        const targetSize = 224; // Standard model input size (backend resizes this anyway)

        canvas.width = targetSize;
        canvas.height = targetSize;

        // Calculate center crop
        const sx = (video.videoWidth - roiSize) / 2;
        const sy = (video.videoHeight - roiSize) / 2;

        // Draw cropped ROI to canvas
        ctx.drawImage(video, sx, sy, roiSize, roiSize, 0, 0, targetSize, targetSize);

        // --- PREPROCESSING PIPELINE (Client-Side) ---
        // 1. Get raw pixel data
        let imageData = ctx.getImageData(0, 0, targetSize, targetSize);

        // 2. Apply Filters (Sequence matches training data style: Drawing/Sketch)
        imageData = toGrayscale(imageData);
        imageData = boxBlur(imageData, 4);              // Strong Blur (Smoothens skin texture)
        imageData = adaptiveThreshold(imageData, 2);    // Threshold (White BG, Black Lines)

        // 3. Geometry Filtering (No filling, preserve internal details)
        imageData = keepLargestContour(imageData);      // Remove face/background noise
        imageData = erode(imageData, 1);                // Thicken contours (Make lines distinct)

        // 4. Center
        imageData = centerContent(imageData);           // Center the sketch in frame

        // 5. Put processed data back
        ctx.putImageData(imageData, 0, 0);
        // --------------------------------------------

        // Convert to base64
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

        try {
          const response = await fetch('http://localhost:5000/predict', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageBase64 }),
          });

          if (response.ok) {
            const data = await response.json();
            setConfidence(data.confidence || 0);

            const newSentence = data.sentence || "";
            if (newSentence !== combinedSentence) {
              setCombinedSentence(newSentence);
              setDetectedText(newSentence ? newSentence.split(" ") : []);
            }

            setCurrentWord(data.word || "");
          }
        } catch (error) {
          // Ignore transient network errors
        }
      }
    };

    if (isRecognizing) {
      intervalId = setInterval(processFrame, 200);
    }

    return () => clearInterval(intervalId);
  }, [isRecognizing, combinedSentence]);


  const handleReset = async () => {
    setDetectedText([]);
    setConfidence(0);
    setCombinedSentence("");
    setCurrentWord("");
    try {
      await fetch('http://localhost:5000/reset', { method: 'POST' });
    } catch (e) { console.error(e); }
  };

  const handleStop = () => {
    setIsRecognizing(false);
    onStop();
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900">
      {/* Canvas moved to ROI overlay */}

      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-20 left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 p-6 border-b border-white/10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-xl">
            <Hand className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              SignSpeak Recognition
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isRecognizing && (
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="flex items-center gap-2 text-green-400"
              >
                <Activity className="w-5 h-5" />
                <span className="text-sm">Active</span>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Split Layout */}
          {/* Split Layout - Modified to 2/3 split for larger camera */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Camera Feed (Takes up 2 columns ~66%) */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-2"
            >
              <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-6 border border-white/20 h-full">
                <div className="flex items-center gap-2 mb-4">
                  <Video className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg text-white">Live Camera Input</h2>
                </div>

                {/* Camera Preview */}
                <div
                  ref={videoRef}
                  className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-white/10"
                >
                  <div className="absolute inset-0 bg-black flex items-center justify-center">
                    {!isRecognizing && (
                      <div className="text-white/50 flex flex-col items-center">
                        <Hand className="w-16 h-16 mb-2 opacity-50" />
                        <span>Camera Off</span>
                      </div>
                    )}
                    <video
                      ref={videoElementRef}
                      className={`w-full h-full object-cover transform scale-x-[-1] ${!isRecognizing ? 'hidden' : ''}`}
                      playsInline
                      muted
                    />
                  </div>

                  {/* ROI Overlay Logic */}
                  {/* ROI Overlay Logic: VISUAL GUIDE ONLY - NO DIMMING */}
                  {isRecognizing && (
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Simple Green Guide Box centered */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border-2 border-green-400 rounded-lg shadow-[0_0_15px_rgba(74,222,128,0.5)]">
                        {/* Grid Guidelines inside ROI */}
                        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-30">
                          <div className="border-r border-b border-green-400"></div>
                          <div className="border-b border-green-400"></div>
                          <div className="border-r border-green-400"></div>
                          <div></div>
                        </div>
                        {/* Label */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-green-400 text-xs font-bold bg-black/60 px-3 py-1 rounded backdrop-blur-md border border-green-400/30">
                          PLACE HAND HERE
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Helper Overlays */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Scanning effect - confined to ROI or full screen? keeping it subtle */}
                    {isRecognizing && (
                      <motion.div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[20px] bg-green-400/20 blur-md"
                        animate={{
                          y: [-140, 140],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                    )}
                  </div>

                  {/* Status indicator */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                    <div className="backdrop-blur-md bg-black/50 px-4 py-2 rounded-full border border-white/20">
                      <span className="text-white text-sm">
                        {isRecognizing ? "Recognizing..." : "Stopped"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Confidence Indicator */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 text-sm">Confidence</span>
                    <span className="text-blue-400">{confidence.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${confidence}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Panel - Processed View & Text Output */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-1 flex flex-col gap-6"
            >
              {/* 1. PROCESSED HAND PREVIEW (Top Right) */}
              <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-6 border border-white/20">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <h2 className="text-lg text-white">Processed Input</h2>
                </div>

                {/* Visual Preview Box */}
                <div className="bg-white rounded-2xl overflow-hidden aspect-square relative border-4 border-white/10 shadow-inner flex items-center justify-center">
                  {/* The canvas used for valid inference input is now visible here */}
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full object-contain"
                  />

                  {!isRecognizing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100/10">
                      <span className="text-gray-400 text-sm">Waiting...</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  This is what the AI model sees. Ensure hand is valid here.
                </p>
              </div>

              {/* 2. TEXT OUTPUT (Below) */}
              <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-6 border border-white/20 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg text-white">Detected Text</h2>
                </div>

                {/* Text Output Box */}
                <div className="flex-1 bg-slate-900/50 rounded-2xl p-6 border border-white/10 overflow-y-auto min-h-[200px]">
                  {detectedText.length === 0 && !currentWord ? (
                    <motion.p
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-gray-500 italic"
                    >
                      {isRecognizing ? "Waiting for sign..." : "No text detected yet"}
                    </motion.p>
                  ) : (
                    <div className="space-y-2">
                      {detectedText.map((text, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3 }}
                          className="text-white text-lg"
                        >
                          <span className="text-gray-500 mr-2">›</span>
                          {text}
                        </motion.div>
                      ))}
                      {currentWord && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-blue-400 text-lg font-bold"
                        >
                          <span className="text-gray-500 mr-2">...</span>
                          {currentWord}
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                {/* Full Text Display */}
                {(detectedText.length > 0 || currentWord) && (
                  <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-sm text-gray-400 mb-2">Combined Output:</p>
                    <p className="text-white">
                      {detectedText.join(" ")} <span className="text-blue-400">{currentWord}</span>
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Bottom Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-6 flex items-center justify-center gap-4"
          >
            {/* Stop Button */}
            <motion.button
              onClick={handleStop}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="backdrop-blur-xl bg-red-500/10 border-2 border-red-500 text-red-400 px-8 py-3 rounded-xl flex items-center gap-2 hover:bg-red-500/20 transition-all"
            >
              <StopCircle className="w-5 h-5" />
              <span>Stop Recognition</span>
            </motion.button>

            {/* Reset Button */}
            <motion.button
              onClick={handleReset}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="backdrop-blur-xl bg-white/5 border border-white/20 text-white px-8 py-3 rounded-xl flex items-center gap-2 hover:bg-white/10 transition-all"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Reset</span>
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
