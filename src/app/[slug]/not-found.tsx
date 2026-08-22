export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-white">
      <h1 className="text-xl font-semibold text-gray-800 mb-2">
        Survey not found.
      </h1>
      <p className="text-sm text-gray-500">
        This link may be invalid or expired.
      </p>
    </div>
  );
}
