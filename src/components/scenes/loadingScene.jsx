import { VscLoading } from "react-icons/vsc";

export default function LoadingScene({
  message = "Đang tải...",
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[350px] w-full p-8 text-center select-none ${className}`}
    >
      <div className="relative flex items-center justify-center mb-4">
        {/* Main circular loading spinner */}
        <div className="relative flex items-center justify-center p-3">
          <VscLoading className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </div>

      {/* Loading message */}
      <span className="text-sm font-medium text-gray-600">{message}</span>
    </div>
  );
}
