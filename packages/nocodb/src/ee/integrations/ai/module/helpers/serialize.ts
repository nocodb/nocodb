import { type Readable } from 'stream';
import { UnstructuredClient } from 'unstructured-client';
import { Strategy } from 'unstructured-client/sdk/models/shared';
import pdf from 'pdf-parse';

const key = process.env.UNSTRUCTURED_API_KEY;
const url = process.env.UNSTRUCTURED_API_URL;
const unstructuredAvailable = url && url.length > 0;

const client = new UnstructuredClient({
  serverURL: url,
  ...(key && { security: { apiKeyAuth: key } }),
});

const serializers = {
  'application/pdf': async (
    stream: Readable,
  ): Promise<{
    text: string;
    images: {
      type: 'image';
      image: string;
    }[];
  }> => {
    const data = await getDataFromStream(stream);

    if (!unstructuredAvailable) {
      const pdfData = await pdf(data);

      return {
        text: pdfData.text,
        images: [],
      };
    }

    const res = await client.general.partition({
      partitionParameters: {
        files: {
          content: data,
          fileName: 'file.pdf',
        },
        strategy: Strategy.HiRes,
        extractImageBlockTypes: ['Image'],
        splitPdfPage: true,
        splitPdfConcurrencyLevel: 5,
        splitPdfAllowFailed: true,
      },
    });

    if (!res.statusCode || res.statusCode !== 200 || !res.elements) {
      console.log('Error in partitioning');
      return;
    }

    const textData = res.elements
      .map((element) => element?.text || '')
      .join('\n');

    const images = res.elements
      .filter((element) => element?.type === 'Image')
      .map((m) => {
        return {
          type: 'image' as const,
          image: m.metadata?.image_base64,
        };
      });

    return {
      text: textData,
      images,
    };
  },
  default: async (
    stream: Readable,
  ): Promise<{
    text: string;
    images: {
      type: 'image';
      image: string;
    }[];
  }> => {
    const data = await getDataFromStream(stream);
    const text = data.toString('utf-8');

    return {
      text,
      images: [],
    };
  },
};

const getDataFromStream = (stream: Readable): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks = [];

    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
};

export const serialize = async (
  mimetype: string,
  stream: Readable,
  fallback?: string,
): Promise<{
  text: string;
  images: {
    type: 'image';
    image: string;
  }[];
}> => {
  try {
    const serializer = serializers[mimetype] || serializers.default;
    const data = await serializer(stream);

    return data;
  } catch (error) {
    console.error(error);
    return {
      text: fallback ?? '@file_not_supported',
      images: [],
    };
  }
};
