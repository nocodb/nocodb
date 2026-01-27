import opentelemetry from '@opentelemetry/api';


const tracer = opentelemetry.trace.getTracer('decorator');
type OpenTelemetryTracer = ReturnType<typeof opentelemetry.trace.getTracer>;

/**
 * A decorator that enables otel tracing on a method.
 * @param method
 */
export function trace(
): (
  target: any,
  methodName: string,
  descriptor: PropertyDescriptor,
) => void {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const className: string = target.constructor.name; // correct type: Function
    // eslint-disable-next-line @typescript-eslint/ban-types
    const originalMethod: Function = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      return tracer.startActiveSpan(
        `${className}.${propertyKey}`,
        {},
        async (span) => {
          try {
            return await originalMethod.apply(this, args);
          } catch (err) {
            span.recordException(err as Error);
            throw err;
          } finally {
            span.end();
          }
        },
      );
    };
  };
}