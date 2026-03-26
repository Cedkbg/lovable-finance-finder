declare module 'papaparse' {
  export interface ParseResult<T = any> {
    data: T[];
    errors: any[];
    meta: any;
  }

  function parse(data: string | File | Blob, options: any): void;
  export default parse;
}
