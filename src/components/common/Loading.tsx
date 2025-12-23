import React from 'react';

interface LoadingProps {
  fullScreen?: boolean;
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({ fullScreen = false, text = '読み込み中...' }) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-line-green border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500">{text}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-line-light">
        {content}
      </div>
    );
  }

  return <div className="py-8">{content}</div>;
};
