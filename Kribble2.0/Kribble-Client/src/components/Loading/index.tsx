import { HTMLAttributes, PropsWithChildren } from 'react';

import Text from '../Text';

interface LoadingProps {
  fullScreen?: boolean;
}

const LoadingParent = ({
  fullScreen,
  children,
  ...rest
}: LoadingProps &
  PropsWithChildren &
  Omit<HTMLAttributes<HTMLElement>, 'className'>) => {
  if (fullScreen)
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: 'var(--board-green)',
        }}
        {...rest}
      >
        {children}
      </div>
    );
  return (
    <div style={{ width: '100%', height: '100%' }} {...rest}>
      {children}
    </div>
  );
};

const LoadingChild = ({ fullScreen }: LoadingProps) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {fullScreen && <Text style={{ marginBottom: '1rem' }}>Loading...</Text>}
      <svg
        style={{
          width: fullScreen ? '20%' : '32px',
          aspectRatio: '1/1',
          animation: 'spin 1s linear infinite',
        }}
        viewBox="0 0 100 100"
      >
        <circle
          r={45}
          cx={50}
          cy={50}
          width={100}
          height={100}
          strokeWidth={fullScreen ? 2 : 4}
          strokeDasharray={100}
          strokeDashoffset={100}
          strokeLinecap="round"
          style={{
            stroke: 'var(--chalk-white)',
            fill: 'none',
            transformOrigin: 'center',
          }}
        />
      </svg>
    </div>
  );
};

const Loading = ({
  fullScreen = false,
  ...rest
}: LoadingProps & Omit<HTMLAttributes<HTMLElement>, 'className'>) => {
  return (
    <LoadingParent fullScreen={fullScreen} {...rest}>
      <LoadingChild fullScreen={fullScreen} />
    </LoadingParent>
  );
};

export default Loading;
