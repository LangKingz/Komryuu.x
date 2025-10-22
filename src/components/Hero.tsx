import React from "react";

const Hero = () => {
  return (
    <div className="relative flex justify-center items-center h-screen overflow-hidden">
      <div className="hero-glow-bg"></div>
      <div className="z-10">
        <h1 className="text-3xl font-bold mb-4 md:text-6xl text-center">Welcome to Komryuu.x</h1>
        <p className="text-xl">Your gateway to seamless experiences.</p>
      </div>
      <div className="flex absolute top-0 right-0 z-20 p-2">
        <p className="text-sm">Version 1.0.0</p>
      </div>
    </div>
    
  );
};

export default Hero;
