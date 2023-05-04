import axios from 'axios';
import listContent from 'list-github-dir-content';
import { marked } from 'marked';

async function listDirectory(
  user: string,
  repository: string,
  ref: string,
  dir: string,
  token = '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',
) {
  const files = await listContent.viaTreesApi({
    user,
    repository,
    ref,
    directory: decodeURIComponent(dir),
    token: token,
    getFullData: true,
  });

  return files;
}

async function getMarkdownFiles(
  files: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string;
    size: number;
    url: string;
  }>,
) {
  const markdownFiles = files.filter((file) => file.path.endsWith('.md'));
  return markdownFiles;
}

async function fetchMarkdownContent(
  user: string,
  repository: string,
  ref: string,
  path: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    axios(
      `https://raw.githubusercontent.com/${user}/${repository}/${ref}/${escapeFilepath(
        path,
      )}`,
    )
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

export async function fetchGHDocs(
  user: string,
  repository: string,
  ref: string,
  dir: string,
  type = 'md',
) {
  const files = await listDirectory(user, repository, ref, dir);
  const markdownFiles = await getMarkdownFiles(files);

  const docs = [];

  if (type === 'md') {
    for (const file of markdownFiles) {
      const relPath = file.path.replace(dir, '').replace(/^\//, '');
      const pathParts = relPath.split('/').filter((part) => part !== '');
      pathParts.pop();
      let activePath = docs;

      for (const pathPart of pathParts) {
        const fnd = activePath.find((page) => page.title === pathPart);
        if (!fnd) {
          activePath.push({
            title: pathPart,
            content: '',
            pages: [],
          });
          activePath = activePath.find((page) => page.title === pathPart).pages;
        } else {
          activePath = fnd.pages;
        }
      }

      activePath.push({
        title: file.path.split('/').pop().replace('.md', ''),
        ...processContent(
          await fetchMarkdownContent(user, repository, ref, file.path),
          type,
        ),
        pages: [],
      });

      activePath.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    }
  } else if (type === 'nuxt') {
    for (const file of markdownFiles) {
      const processedContent = processContent(
        await fetchMarkdownContent(user, repository, ref, file.path),
        type,
      );
      if (processedContent?.category) {
        let fnd = docs.find((page) => page.title === processedContent.category);

        if (!fnd) {
          docs.push({
            title: processedContent.category,
            order: processedContent.order,
            content: '',
            pages: [],
          });
          fnd = docs.find((page) => page.title === processedContent.category);
        }

        fnd.pages.push({
          title: file.path.split('/').pop().replace('.md', ''),
          ...processedContent,
          pages: [],
        });

        fnd.pages.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
      } else {
        docs.push({
          title: file.path.split('/').pop().replace('.md', ''),
          content: '',
          order: processedContent.order,
          pages: [
            {
              title: file.path.split('/').pop().replace('.md', ''),
              ...processedContent,
              pages: [],
            },
          ],
        });
      }

      docs.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    }
  }

  return docs;
}

function processContent(content: string, type: string): any {
  switch (type) {
    case 'nuxt': {
      const metaObj = {};
      if (content.startsWith('---')) {
        const meta = content.split('---')[1];
        meta.split('\n').forEach((line) => {
          if (!line.includes(':')) return;
          const [key, value] = line.split(':');
          metaObj[key.trim()] = value.trim();
        });
        content = content.split('---')[2];
      }
      const tempArgs = {
        category: metaObj['category']?.replace(/^["'](.+(?=["']$))["']$/, '$1'),
        content: marked(content),
        order: metaObj['position'] || null,
        description: metaObj['description']?.replace(
          /^["'](.+(?=["']$))["']$/,
          '$1',
        ),
      };

      if (metaObj['menuTitle'])
        tempArgs['title'] = metaObj['title'].replace(
          /^["'](.+(?=["']$))["']$/,
          '$1',
        );

      return tempArgs;
    }
    case 'md':
    default:
      return {
        content: marked(content),
      };
  }
}

function escapeFilepath(path) {
  return path.replaceAll('#', '%23');
}
