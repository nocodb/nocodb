// `Model.getWithInfo` hydrates `views` with the stored view rows, so a
// password-protected sibling share's uuid + bcrypt hash rides along to whoever
// receives the model. Return a copy — the argument is a cached instance.
export function withoutViewSecrets<T extends { views?: any[] }>(model: T): T {
  if (!model?.views?.length) return model;

  return Object.assign(Object.create(Object.getPrototypeOf(model)), model, {
    views: model.views.map((view) =>
      Object.assign(Object.create(Object.getPrototypeOf(view)), view, {
        password: undefined,
        uuid: undefined,
      }),
    ),
  });
}
