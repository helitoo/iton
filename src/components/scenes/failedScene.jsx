import { VscError, VscRefresh } from "react-icons/vsc";

export default function FailedScene({
  message = "Không thể tải dữ liệu. Vui lòng thử lại sau.",
  onReload,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[350px] w-full p-8 text-center select-none ${className}`}
    >
      <div className="flex items-center justify-center p-3 mb-4 rounded-full bg-red-50 border border-red-100 text-red-500 shadow-sm">
        <VscError className="w-9 h-9" />
      </div>

      <h3 className="text-base font-semibold text-gray-800 mb-1">
        Tải dữ liệu thất bại
      </h3>

      <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
        {message}
      </p>

      {onReload && (
        <button
          type="button"
          onClick={onReload}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <VscRefresh className="w-4 h-4 shrink-0" />
          <span>Tải lại</span>
        </button>
      )}
    </div>
  );
}
