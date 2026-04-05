import { useEffect, useRef } from 'react';

import { useCanvas } from '../../contexts/canvas';
import { useGame } from '../../contexts/game';
import usePointerTracker from '../../hooks/usePointerTracker';
import { CanvasAction } from '../../types/canvas';
import { GameStatus } from '../../types/models/game';

import useCanvasActions, { OptionConfig } from './useCanvasActions';

interface CanvasProps {
  optionConfig?: OptionConfig;
}

const Canvas = ({ optionConfig }: CanvasProps) => {
  const { ref: canvasRef, drawing } = useCanvas();
  const {
    game: { canvasOperations, status },
  } = useGame();
  const isMountedRef = useRef(false);
  const pointerConfig = useCanvasActions(optionConfig);

  usePointerTracker(canvasRef, pointerConfig);

  const handleCanvasResize = async () => {
    if (!canvasRef.current) return;

    // Size Handling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    canvasRef.current.width = Math.max(1, Math.round(rect.width * dpr));
    canvasRef.current.height = Math.max(1, Math.round(rect.height * dpr));

    // Drawing Handling
    drawing?.loadOperations([{ actionType: CanvasAction.CLEAR }], false, false);
    if (isMountedRef.current) await drawing?.reloadOperations();
    else await drawing?.loadOperations(canvasOperations, false);
    isMountedRef.current = true;
  };

  useEffect(() => {
    void handleCanvasResize();
    const onViewportChange = () => void handleCanvasResize();
    window.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);
    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
    };
  }, []);

  useEffect(() => {
    drawing?.reset();
  }, [status]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        width: '100%',
        height: '100%',
        aspectRatio: '16/9',
        touchAction: 'none',
        pointerEvents: status === GameStatus.GAME ? 'auto' : 'none',
      }}
    />
  );
};

export default Canvas;
