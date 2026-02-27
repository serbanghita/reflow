import React from "react";

interface HeaderProps {
  pixelsPerMinute: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

export function Header({ pixelsPerMinute, onZoomIn, onZoomOut, onFit }: HeaderProps) {
  const zoomPercent = Math.round(pixelsPerMinute * 100);

  return (
    <header className="header">
      <h1>Settlement Schedule Reflow Engine</h1>
      <div className="header-controls">
        <button className="zoom-button" onClick={onZoomOut} title="Zoom out">
          -
        </button>
        <span className="zoom-level">{zoomPercent}%</span>
        <button className="zoom-button" onClick={onZoomIn} title="Zoom in">
          +
        </button>
        <button className="zoom-button" onClick={onFit} title="Fit to view">
          ⊞
        </button>
      </div>
    </header>
  );
}
