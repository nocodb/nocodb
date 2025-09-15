export * from 'src/utils/envs';
export const isMuxEnabled = process.env.NC_DISABLE_MUX !== 'true';
