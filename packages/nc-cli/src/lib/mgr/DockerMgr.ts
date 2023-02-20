import NewMgr from './NewMgr';

import('colors');
import fs from 'fs';
import path from 'path';

class DockerMgr extends NewMgr {
  public static async genDockerfile(args: any) {
    const dockerFilePath = path.join(process.cwd(), 'Dockerfile');
    try {
      args._.push('placeholder');
      if (await this.getNewProjectInput(args)) {
        const dockerfileContent = this.getDockerfileContent(args);
        fs.writeFileSync(dockerFilePath, dockerfileContent);
        console.log(`Docker file created successfully`.green.bold);
        console.log(`\tFile location : ${dockerFilePath}`.green);
        console.log(`\tdocker build . -t xc`.green.bold);
      } else {
        // console.log('Database connection failed')
      }
    } catch (e) {
      console.log('Error in docker file creation', e);
    }
  }

  private static getDockerfileContent(args) {
    return `FROM nocodb/nocodb:latest

ENV PORT 8080
ENV NODE_ENV=dev
ENV TOOL_DIR=/tool
${args.url
  .map((url, i) => `ENV DB_URL${i > 0 ? i + 1 : ''}=${url}`)
  .join('\r\n')}

`;
  }
}

export default DockerMgr;
