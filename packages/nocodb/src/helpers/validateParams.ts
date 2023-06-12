export default function validateParams(props: string[], body: any) {
  for (const prop of props) {
    if (!(prop in body))
      throw new Error(`Missing '${prop}' property in request body`);
  }
}
