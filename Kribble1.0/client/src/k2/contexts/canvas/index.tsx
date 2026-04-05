import {
  createContext,
  MutableRefObject,
  ReactNode,
  useContext,
  useRef,
} from 'react';

import { Drawing } from '../../utils/classes/drawing';

interface CanvasContextInterface {
  ref: MutableRefObject<HTMLCanvasElement | null>;
  drawing?: Drawing;
}

const CanvasContext = createContext<CanvasContextInterface>({
  ref: { current: null },
  drawing: undefined,
});

interface CanvasProviderProps {
  children: ReactNode;
}

const CanvasProvider = ({ children }: CanvasProviderProps) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(new Drawing(ref));

  return (
    <CanvasContext.Provider
      value={{
        ref,
        drawing: drawingRef.current,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => useContext(CanvasContext);
export default CanvasProvider;
