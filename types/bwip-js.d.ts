// bwip-js ships types behind export conditions ("node"/"browser") that tsconfig's
// "bundler" resolution does not match — declare the minimal server-side surface we use.
declare module "bwip-js" {
  export interface BwipOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    includetext?: boolean;
    textxalign?: string;
  }
  const bwipjs: { toBuffer(opts: BwipOptions): Promise<Buffer> };
  export default bwipjs;
}
