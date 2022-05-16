const OCURLY_CODE = 123; // {
const CCURLY_CODE = 125; // }

export default {
    name: 'curly',
    init(jsep) {
        jsep.hooks.add('gobble-token', function gobbleCurlyLiteral(env) {
            const { context } = env
            if (!jsep.isIdentifierStart(context.code) && context.code === OCURLY_CODE) {
                context.index += 1
                let nodes = context.gobbleExpressions(CCURLY_CODE)
                if (context.code === CCURLY_CODE) {
                    context.index += 1
                    if (nodes.length > 0) {
                        env.node = nodes[0]
                    }
                    return env.node
                } else {
                    context.throwError('Unclosed }')
                }
            }
        });
    }
}