"use client";

interface DeleteDesignConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteDesignConfirmModal({
  isOpen,
  onClose,
  onConfirm,
}: DeleteDesignConfirmModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-describedby="delete-design-description"
        aria-labelledby="delete-design-title"
        aria-modal="true"
        className="w-full max-w-[440px] rounded-2xl bg-white px-7 py-8 shadow-2xl"
        role="dialog"
      >
        <div className="text-center">
          <h2 id="delete-design-title" className="text-base font-bold text-gray-950">
            이 디자인을 삭제할까요?
          </h2>
          <p
            id="delete-design-description"
            className="mt-3 text-xs leading-5 text-gray-500"
          >
            삭제하면 되돌릴 수 없어요.
            <br />
            아래 내용이 함께 사라집니다.
          </p>
        </div>

        <ul className="my-4 list-[square] space-y-1 rounded-xl bg-gray-50 p-4 pl-8 text-xs text-gray-700">
          <li>3D 모델 파일과 미리보기</li>
          <li>이 디자인을 만든 대화와 버전 기록</li>
          <li>Feed에 공개한 게시물</li>
        </ul>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-[58px] rounded-lg border border-gray-300 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-[58px] rounded-lg bg-red-500 text-sm font-medium text-white transition-colors hover:bg-red-600"
          >
            삭제하기
          </button>
        </div>
      </section>
    </div>
  );
}
