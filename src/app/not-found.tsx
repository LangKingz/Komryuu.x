import Link from "next/link";

// Anda bisa membuat SVG ini menjadi komponen terpisah jika diinginkan
const LostAstronautIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 md:h-48 md:w-48 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    {/* The SVG paths for the icon */}
    <path d="M12 2a9.4 9.4 0 0 0-4 1.4 9.8 9.8 0 0 0-3.4 3.5A10 10 0 0 0 2 12a10 10 0 0 0 2.6 6.1 9.8 9.8 0 0 0 3.4 3.5 9.4 9.4 0 0 0 4 1.4 9.4 9.4 0 0 0 4-1.4 9.8 9.8 0 0 0 3.4-3.5A10 10 0 0 0 22 12a10 10 0 0 0-2.6-6.1 9.8 9.8 0 0 0-3.4-3.5A9.4 9.4 0 0 0 12 2Z" />
    <path d="M8 12a4 4 0 1 0 8 0" />
    <path d="M12 18a6 6 0 0 0-4.4 2" />
    <path d="M12 22v-2" />
    <path d="M18 17a4 4 0 0 0-1.3-3" />
    <path d="M6 17a4 4 0 0 1 1.3-3" />
  </svg>
);

export default function NotFound() {
  return (
    <div className="bg-gray-900 min-h-screen flex items-center justify-center text-center text-white px-4">
      <div className="flex flex-col items-center">
        <LostAstronautIcon />
        <h1 className="mt-8 text-6xl md:text-9xl font-extrabold text-indigo-500 tracking-tighter">404</h1>
        <h2 className="mt-4 text-2xl md:text-3xl font-bold">Sepertinya Kamu Tersesat</h2>
        <p className="mt-2 max-w-md text-gray-400">Halaman yang kamu cari sepertinya telah dipindahkan ke dimensi lain atau mungkin tidak pernah ada.</p>
        <Link href={"/"} className="mt-8 inline-block bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 transform hover:scale-105 transition-all duration-300">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}