import { type Readable } from 'stream';
import pdf from 'pdf-parse';

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

    const pdfData = await pdf(data);

    return {
      text: pdfData.text,
      images: [],
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
