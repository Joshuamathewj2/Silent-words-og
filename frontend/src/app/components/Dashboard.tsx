import { motion } from "framer-motion";
import { Play, Hand, Sparkles, Activity } from "lucide-react";

interface DashboardProps {
  onStartRecognition: () => void;
}

export function Dashboard({ onStartRecognition }: DashboardProps) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900">
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
      <div className="relative z-10 p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="relative">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-xl">
              <Hand className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              SilentWords
            </h1>
          </div>
        </motion.div>
      </div>

      {/* Main Hero Section */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-100px)] px-4">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            {/* Icon with animation */}
            <motion.div
              className="inline-flex items-center justify-center mb-8"
              animate={{
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <div className="relative">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-50"
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="relative bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-xl p-8 rounded-3xl border border-white/20">
                  <Activity className="w-20 h-20 text-blue-400" />
                  <Sparkles className="w-8 h-8 text-purple-400 absolute -top-2 -right-2" />
                </div>
              </div>
            </motion.div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent leading-tight">
              Convert Sign Language to Text in Real Time
            </h1>

            {/* Description */}
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto">
              Click start, show your sign, and let AI do the rest.
            </p>
          </motion.div>

          {/* Main CTA Button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex justify-center"
          >
            <motion.button
              onClick={onStartRecognition}
              className="relative group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Animated glow effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-2xl opacity-50 group-hover:opacity-75"
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Button */}
              <div className="relative bg-gradient-to-r from-blue-500 to-purple-500 rounded-full p-1">
                <div className="bg-gradient-to-br from-slate-950 to-purple-950 rounded-full px-12 py-6 flex items-center gap-4 group-hover:from-blue-500/10 group-hover:to-purple-500/10 transition-all duration-300">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4 rounded-full">
                    <Play className="w-8 h-8 text-white fill-white" />
                  </div>
                  <span className="text-2xl text-white">
                    Start Recognition
                  </span>
                </div>
              </div>
            </motion.button>
          </motion.div>

          {/* Feature Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto"
          >
            {[
              { icon: Activity, text: "Real-time Processing" },
              { icon: Hand, text: "Advanced AI Recognition" },
              { icon: Sparkles, text: "High Accuracy" },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="backdrop-blur-xl bg-white/5 rounded-2xl p-6 border border-white/10"
              >
                <feature.icon className="w-8 h-8 text-blue-400 mb-3 mx-auto" />
                <p className="text-gray-300">{feature.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
