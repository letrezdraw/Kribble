import React, {
  ChangeEvent,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  useEffect,
  useRef,
} from 'react';
import { FaEraser, FaFillDrip, FaPencilAlt, FaTrash } from 'react-icons/fa';
import { IoMdColorPalette } from 'react-icons/io';

import Tooltip from '@/components/Tooltip';
import { GameEvents } from '@/constants/Events';
import { useCanvas } from '@/contexts/canvas';
import { useSocket } from '@/contexts/socket';
import { ServerToClientEvents } from '@/types/socket';

import Canvas from '../components/Canvas';
import { OptionConfig } from '../components/Canvas/useCanvasActions';
import EditOption from '../components/Option';
import { OptionKey, options } from '../components/Option/utils';

const icons: Record<OptionKey, ReactElement> = {
  [OptionKey.PENCIL]: <FaPencilAlt />,
  [OptionKey.ERASER]: <FaEraser />,
  [OptionKey.FILL]: <FaFillDrip />,
  [OptionKey.CLEAR]: <FaTrash />,
};

export interface ToolbarProps {
  optionConfig: OptionConfig;
  setOptionConfig: React.Dispatch<React.SetStateAction<OptionConfig>>;
  isDrawing: boolean;
  onClear: () => void;
}

interface MainProps extends HTMLAttributes<HTMLDivElement> {
  component: ReactNode;
  optionConfig: OptionConfig;
  setOptionConfig: React.Dispatch<React.SetStateAction<OptionConfig>>;
  isDrawing: boolean;
}

// Toolbar component that can be rendered separately
export const Toolbar = ({
  optionConfig,
  setOptionConfig,
  isDrawing,
  onClear,
}: ToolbarProps) => {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleOptionConfigChange = (ev: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = ev.target;
    setOptionConfig((prev) => ({
      ...prev,
      [name]:
        typeof optionConfig[name as keyof OptionConfig] === 'number'
          ? Number(value)
          : value,
    }));
  };

  const handlers: Record<OptionKey, () => void> = {
    [OptionKey.PENCIL]: () => {},
    [OptionKey.ERASER]: () => {},
    [OptionKey.FILL]: () => {},
    [OptionKey.CLEAR]: onClear,
  };

  const editOptions = options.map((option) => ({
    ...option,
    icon: icons[option.key],
    handler: handlers[option.key],
    disabled: !isDrawing,
  }));

  return (
    <div
      style={{
        display: 'flex',
        flex: '1 1 auto',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '2rem',
        height: '100%',
        padding: '0 1.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          flex: '1 1 auto',
          flexGrow: 0,
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'rgba(255,255,255,0.05)',
          padding: '0.5rem 1rem',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {editOptions.map(({ isSelectable, handler, icon, key, disabled }) => (
          <EditOption
            key={key}
            isSelected={key === optionConfig.type}
            onClick={() => {
              if (isSelectable)
                setOptionConfig((prev) => ({ ...prev, type: key }));
              handler?.();
            }}
            disabled={disabled}
            label={key}
            icon={icon}
          />
        ))}
        <Tooltip label="Color">
          <button
            onClick={() => colorInputRef.current?.click()}
            style={{
              position: 'relative',
              padding: '0.5rem',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: optionConfig.color,
              cursor: 'pointer',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            }}
          >
            <IoMdColorPalette
              style={{
                fontSize: 'var(--text-lg)',
                mixBlendMode: 'difference',
              }}
            />
            <input
              ref={colorInputRef}
              type="color"
              name="color"
              style={{
                position: 'absolute',
                opacity: 0,
                width: '100%',
                height: '100%',
                top: 0,
                left: 0,
                cursor: 'pointer',
              }}
              value={optionConfig.color}
              onChange={handleOptionConfigChange}
            />
          </button>
        </Tooltip>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'rgba(255,255,255,0.05)',
          padding: '0.5rem 1rem',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div
          style={{ position: 'relative', width: '2.5rem', height: '2.5rem' }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: 'white',
              width: `${optionConfig.brushSize}px`,
              height: `${optionConfig.brushSize}px`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          ></div>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '2px',
              height: '1rem',
              top: 0,
              background: 'var(--dark-chalk-white)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '2px',
              height: '1rem',
              top: '50%',
              background: 'var(--dark-chalk-white)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              transform: 'translateY(-50%)',
              width: '1rem',
              height: '2px',
              top: '50%',
              background: 'var(--dark-chalk-white)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateY(-50%)',
              width: '1rem',
              height: '2px',
              top: '50%',
              background: 'var(--dark-chalk-white)',
            }}
          />
        </div>
        <input
          type="range"
          min={5}
          max={31}
          step={2}
          name="brushSize"
          value={optionConfig.brushSize}
          onChange={handleOptionConfigChange}
        />
      </div>
    </div>
  );
};

const Main = ({
  component,
  optionConfig,
  setOptionConfig,
  isDrawing,
  ...props
}: MainProps) => {
  const { registerEvent, unregisterEvent } = useSocket();
  const { drawing } = useCanvas();

  const handleOnGameCanvasOperation: ServerToClientEvents[GameEvents.ON_GAME_CANVAS_OPERATION] =
    ({ canvasOperation }) => {
      drawing?.loadOperations([canvasOperation]);
    };

  // Receive operations when user is not a drawer
  useEffect(() => {
    if (!isDrawing) {
      registerEvent(
        GameEvents.ON_GAME_CANVAS_OPERATION,
        handleOnGameCanvasOperation
      );
      setOptionConfig((prev) => ({ ...prev, type: undefined }));
    } else {
      setOptionConfig((prev) => ({ ...prev, type: OptionKey.PENCIL }));
    }
    return () => {
      unregisterEvent(
        GameEvents.ON_GAME_CANVAS_OPERATION,
        handleOnGameCanvasOperation
      );
    };
  }, [isDrawing, registerEvent, unregisterEvent, setOptionConfig]);

  return (
    <div {...props}>
      <div style={{ position: 'relative', height: '100%' }}>
        <Canvas optionConfig={optionConfig} />
        {component && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              height: '100%',
              overflow: 'scroll',
            }}
          >
            {component}
          </div>
        )}
      </div>
    </div>
  );
};

export default Main;
