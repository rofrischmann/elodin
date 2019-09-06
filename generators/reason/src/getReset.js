const viewResetStyle = `display:flex;align-self:stretch;flex-direction:column;flex-shrink:0;max-width:100%;box-sizing:border-box`
const textResetStyle = `display:inline`

const rootResetStyle = `${viewResetStyle};position:fixed;top:0;bottom:0;left:0;right:0`

const defaultGenerateClassName = type => '_elo_' + type
export function baseReset(generateClassName = defaultGenerateClassName) {
  const viewClassName = generateClassName('view')
  const textClassName = generateClassName('text')

  return `.${viewClassName}{${viewResetStyle}}.${textClassName}{${textResetStyle}}`
}

export function rootReset(rootNode = 'body') {
  return `${rootNode}{${rootResetStyle}}`
}
