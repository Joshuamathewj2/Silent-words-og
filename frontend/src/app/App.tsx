import { useState } from "react";
import { LoginPage } from "./components/LoginPage";
import { Dashboard } from "./components/Dashboard";
import { CameraRecognition } from "./components/CameraRecognition";

type Screen = "login" | "dashboard" | "camera";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("login");

  return (
    <div className="dark size-full">
      {currentScreen === "login" && (
        <LoginPage onLogin={() => setCurrentScreen("dashboard")} />
      )}
      {currentScreen === "dashboard" && (
        <Dashboard onStartRecognition={() => setCurrentScreen("camera")} />
      )}
      {currentScreen === "camera" && (
        <CameraRecognition onStop={() => setCurrentScreen("dashboard")} />
      )}
    </div>
  );
}
