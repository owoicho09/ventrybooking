import { ImageResponse } from 'next/og';

export const runtime     = 'edge';
export const size        = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:           '100%',
          height:          '100%',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          backgroundColor: '#7c3aed',
          borderRadius:    '6px',
        }}
      >
        <span
          style={{
            color:      '#ffffff',
            fontSize:   '20px',
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          V
        </span>
      </div>
    ),
    { ...size }
  );
}
