import Hero from "@/components/Hero";

export default function Home() {
  return (
    <div className=" min-h-screen bg-black text-white">
      <div className="modal" role="dialog">
        <div className="modal-box">
          <h3 className="text-lg font-bold">Hello!</h3>
          <p className="py-4">This modal works with a hidden checkbox!</p>
        </div>
        <label className="modal-backdrop" htmlFor="my_modal_7">
          Close
        </label>
      </div>
      <Hero />
    </div>
  );
}
