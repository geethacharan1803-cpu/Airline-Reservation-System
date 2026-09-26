declare module 'sql.js' {
  const initSqlJs: (config?: any) => Promise<any>;
  export default initSqlJs;
  export type Database = any;
}
