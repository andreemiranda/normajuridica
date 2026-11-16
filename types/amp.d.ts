import 'react';

declare module 'react' {
  interface ScriptHTMLAttributes<T> {
    'custom-element'?: string;
  }

  namespace JSX {
    interface IntrinsicElements {
      'amp-auto-ads': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          type?: string;
          'data-ad-client'?: string;
        },
        HTMLElement
      >;
    }
  }
}
