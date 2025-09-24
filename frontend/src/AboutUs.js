import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Parallax } from "react-scroll-parallax";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Lottie from "lottie-react";
import Lenis from "@studio-freight/lenis";


// Import JSON files
import innovationAnim from "./lottie/innovation.json";
import scanAnim from "./lottie/scan.json";

// Fonts
import "@fontsource/sora/700.css";
import "@fontsource/inter/400.css";

function SpinningCube() {
  return (
    <mesh rotation={[0.4, 0.6, 0]}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#6366F1" metalness={0.5} roughness={0.2} />
    </mesh>
  );
}

function AnimatedNetwork({ mouseX, mouseY }) {
  const [time, setTime] = useState(0);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Resize listener
  useEffect(() => {
    const handleResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Animate nodes
  useEffect(() => {
    let frame;
    const animate = () => {
      setTime((t) => t + 0.01);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const { width, height } = dimensions;
  const centerX = width / 2;
  const centerY = height / 2;

  const nodes = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const radius = 250 + (i % 3) * 100;
    return {
      cx: centerX + Math.cos(angle + time) * radius,
      cy: centerY + Math.sin(angle + time) * radius,
    };
  });

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
      style={{
        transform: `translate(${mouseX / 40}px, ${mouseY / 40}px)`,
        transition: "transform 0.1s linear",
      }}
    >
      <g stroke="#00e0ff" strokeWidth="1">
        {nodes.map((n1, i) =>
          nodes.map(
            (n2, j) =>
              i < j && (
                <line
                  key={`${i}-${j}`}
                  x1={n1.cx}
                  y1={n1.cy}
                  x2={n2.cx}
                  y2={n2.cy}
                  strokeOpacity="0.08"
                />
              )
          )
        )}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.cx} cy={n.cy} r="4" fill="#00e0ff" opacity="0.8" />
        ))}
      </g>
    </svg>
  );
}

function CameraScanSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scanY = useTransform(scrollYProgress, [0, 1], ["-100%", "100%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 1], [0, 1, 0]);

  return (
    <section
      ref={ref}
      className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6"
    >
      <div className="relative w-[320px] h-[240px] bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-cyan-400">
        {/* Fake camera feed */}
        <img
          src="https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e"
          alt="Face example"
          className="w-full h-full object-cover opacity-80"
        />

        {/* Scanning line */}
        <motion.div
          style={{ y: scanY, opacity }}
          className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
        />
      </div>

      <motion.p
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="mt-8 text-lg max-w-xl text-gray-300"
      >
        AI-powered face recognition in action. Even with{" "}
        <span className="text-cyan-400 font-semibold">masks</span> or in{" "}
        <span className="text-indigo-400 font-semibold">glasses</span>, FaceTrack
        ensures secure and accurate verification in real time.
      </motion.p>
    </section>
  );
}

function AboutUs() {
  const [loading, setLoading] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Loader
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Smooth scroll
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true, smoothTouch: true });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Floating text animation
  const floating = {
    animate: {
      y: [0, -6, 0],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    },
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <motion.div
          initial={{ scale: 0.8, opacity: 0.6 }}
          animate={{ scale: 1.2, opacity: 1 }}
          transition={{ repeat: Infinity, repeatType: "reverse", duration: 1 }}
          className="text-3xl font-[Sora] font-bold text-indigo-400"
        >
          Loading About Us...
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden text-white font-[Inter] animate-gradient-xy"
      style={{
        background: "linear-gradient(270deg, #141827, #0d0f1a, #000000, #1a1d33)",
        backgroundSize: "600% 600%",
      }}
    >
      {/* Background Animation */}
      <style>
        {`
          @keyframes gradientShift {
            0% {background-position: 0% 50%;}
            50% {background-position: 100% 50%;}
            100% {background-position: 0% 50%;}
          }
          .animate-gradient-xy {
            animation: gradientShift 20s ease infinite;
          }
        `}
      </style>

      {/* AI Network */}
      <AnimatedNetwork mouseX={mousePos.x} mouseY={mousePos.y} />

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6">
        <Parallax speed={-20}>
          <motion.h1
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            animate="animate"
            variants={floating}
            style={{
              textShadow: `${mousePos.x / 100}px ${mousePos.y / 100}px 20px rgba(0,255,255,0.6)`,
            }}
            className="text-5xl md:text-7xl font-[Sora] font-extrabold 
                       bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text 
                       text-transparent tracking-wide drop-shadow-lg"
          >
            FaceTrack Attendance
          </motion.h1>
        </Parallax>
        <Parallax speed={10}>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 1 }}
            className="mt-16 text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed"
          >
            Redefining attendance management with AI-powered precision and
            seamless experience — built to simplify and impress.
            <br />
            <br />
            Powered by <span className="text-cyan-400 font-semibold">Machine Learning </span> 
            and <span className="text-indigo-400 font-semibold">Computer Vision</span>, 
            FaceTrack recognizes employees instantly — even with masks or in 
            glasses.
          </motion.p>
        </Parallax>
      </section>

      {/* 3D Cube Section */}
      <section className="relative z-10 min-h-screen flex flex-col md:flex-row items-center justify-around px-6 py-12">
        <motion.div
          initial={{ opacity: 0, x: -80 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
          className="max-w-md text-center md:text-left"
        >
          <motion.h2
            variants={floating}
            animate="animate"
            className="text-3xl font-[Sora] font-bold bg-gradient-to-r from-indigo-300 to-purple-400 bg-clip-text text-transparent mb-4 tracking-wide"
          >
            Interactive 3D
          </motion.h2>
          <p className="text-lg text-gray-400 leading-relaxed">
            Experience visuals that move with you. Our 3D interface brings
            attendance to life, making everyday tasks more engaging and futuristic.
            <br />
            <br />
            Backed by Deep Convolutional Neural Networks, FaceTrack delivers{" "}
            <span className="text-green-400 font-semibold">99% accuracy</span> in
            face recognition, ensuring real-time validation in just milliseconds.
          </p>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.05, boxShadow: "0px 0px 20px #6366F1" }}
          transition={{ duration: 0.3 }}
          className="w-[320px] h-[320px] bg-gray-200 rounded-xl shadow-2xl flex items-center justify-center"
        >
          <Canvas camera={{ position: [3, 3, 3] }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} />
            <SpinningCube />
            <OrbitControls enableZoom={false} autoRotate />
          </Canvas>
        </motion.div>
      </section>

      {/* Innovation Section */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, scale: 0.2, y: 150 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          animate={{
            y: [0, -10, 0],
            transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          }}
          className="text-4xl md:text-5xl font-[Sora] font-bold 
                     bg-gradient-to-r from-indigo-300 to-cyan-400 
                     bg-clip-text text-transparent mb-6 tracking-wide"
        >
          Innovation in Motion
        </motion.h2>

        <motion.div
  whileHover={{ 
    scale: 1.1, 
    filter: "drop-shadow(0px 0px 15px #00e0ff)", 
    transition: { duration: 0.3 } // hover transition here
  }}
  initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
  whileInView={{ opacity: 1, rotate: 0, scale: 1 }}
  transition={{ duration: 1.2, ease: "easeOut" }} // in-view transition here
  className="w-56 h-56"
>
  <Lottie animationData={innovationAnim} loop />
</motion.div>

        <motion.p
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="mt-6 text-lg max-w-2xl text-gray-400 leading-relaxed"
        >
          Built on innovation, FaceTrack grows smarter with every update —
          delivering faster recognition, richer insights, and effortless workflows.
          <br />
          <br />
          Leveraging <span className="text-cyan-400 font-semibold">Deep Learning</span>, 
          the system adapts across organizations — from startups to enterprise-level.
        </motion.p>
      </section>

      {/* Camera Scan Section */}
        <CameraScanSection />

      {/* Security Section */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          animate="animate"
          variants={floating}
          className="text-4xl font-[Sora] font-bold bg-gradient-to-r from-green-300 to-teal-400 bg-clip-text text-transparent mb-6 tracking-wide"
        >
          Security and Precision
        </motion.h2>
        <motion.div
  whileHover={{ 
    scale: 1.1, 
    filter: "drop-shadow(0px 0px 15px #00ffaa)", 
    transition: { duration: 0.3 }
  }}
  initial={{ opacity: 0, y: 60, scale: 0.7 }}
  whileInView={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ duration: 1.2 }}
  className="w-52 h-52"
>
  <Lottie animationData={scanAnim} loop />
</motion.div>
        <motion.p
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1.2 }}
          className="mt-6 text-lg max-w-xl text-gray-400 leading-relaxed"
        >
          Every log is precise. Every dataset is secure. With advanced
          encryption and AI verification, FaceTrack guarantees your data is safe.
          <br />
          <br />
          Designed for <span className="text-green-400 font-semibold">compliance</span>{" "}
          and <span className="text-green-400 font-semibold">privacy</span>, FaceTrack
          safeguards sensitive employee data with enterprise-level security.
        </motion.p>
      </section>


      {/* Final Section */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6">
        <motion.h2
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          animate="animate"
          variants={floating}
          className="text-5xl md:text-6xl font-[Sora] font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-6 tracking-wider"
        >
          Ready for the Future
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed"
        >
          Designed with speed, precision, and elegance — FaceTrack isn’t just
          attendance. It’s the next step in workplace experience.
        </motion.p>
      </section>
    </div>
  );
}

export default AboutUs;