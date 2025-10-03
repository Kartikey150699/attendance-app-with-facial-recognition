export default function Toast({ message, type, onClose }) {
  return (
    <div
      className={`fixed top-5 right-5 px-4 py-2 rounded shadow-lg text-white z-50 flex items-center justify-between min-w-[250px] ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span>{message}</span>
      <button className="ml-3 font-bold text-lg" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}