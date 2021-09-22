import NewMgr from "./NewMgr";

import('colors');
import fs from 'fs';
import path from 'path';


class DockerMgr extends NewMgr {

  public static async genDockerfile(args: any) {
    const dockerFilePath = path.join(process.cwd(), 'Dockerfile');
    try {
      args._.push('placeholder')
      if(await this.getNewProjectInput(args)) {
        const dockerfileContent = this.getDockerfileContent(args);
        fs.writeFileSync(dockerFilePath, dockerfileContent);
        console.log(`Docker file created successfully`.green.bold)
        console.log(`\tFile location : ${dockerFilePath}`.green)
        console.log(`\tdocker build . -t xc`.green.bold)
      }else{
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
${
      args.url.map((url, i) => `ENV DB_URL${i > 0 ? i + 1 : ''}=${url}`).join('\r\n')
    }

`
  }

}

export default DockerMgr;
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
