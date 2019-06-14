import { isUnitlessProperty } from 'css-in-js-utils'
import color from 'color'

import adapters from './adapters'

import hash from './hash'

const validPseudoClasses = [
  'link',
  'hover',
  'focus',
  'active',
  'visited',
  'disabled',
  'focusWithin',
  'firstChild',
  'lastChild',
]

const validMediaQueries = ['viewportWidth', 'viewportHeight']

export default function createGenerator({
  adapter = 'fela',
  devMode = false,
  rootNode = 'body',
  dynamicImport = false,
} = {}) {
  const usedAdapter = adapters.find(adapt => adapt.name === adapter)
  const config = {
    devMode,
    rootNode,
    dynamicImport,
  }

  return function generate(ast, fileName) {
    const css = generateCSS(ast, config)
    const js = generateJS(ast, config, usedAdapter)
    const root = generateRoot(ast, config)

    return { _root: root, ...css, ...js }
  }
}

function getModuleName(module, devMode) {
  const hashedBody = '_' + hash(JSON.stringify(module.body))

  if (devMode) {
    return module.name + hashedBody
  }
  return hashedBody
}

function generateRoot(ast) {
  // TODO: include fragments
  const styles = ast.body.filter(node => node.type === 'Style')

  const imports = styles
    .map(
      module =>
        'import { ' + module.name + " } from './" + module.name + ".elo.js'"
    )
    .join('\n')

  return (
    imports +
    '\n\n' +
    'export {\n  ' +
    styles.map(module => module.name).join(',\n  ') +
    '\n}'
  )
}

function generateCSSValue(value, property, unit = true) {
  if (value.type === 'Integer') {
    return (
      (value.negative ? '-' : '') +
      value.value +
      (unit && !isUnitlessProperty(property) ? 'px' : '')
    )
  }

  if (value.type === 'RawValue' || value.type === 'String') {
    return value.value
  }

  if (value.type === 'Percentage') {
    if (property === 'opacity') {
      return value.value / 100
    } else {
      return value.value + '%'
    }
  }

  if (value.type === 'Color') {
    const { format, red, blue, green, alpha } = value

    const colorValue = color.rgb(red, green, blue, alpha)
    if (format === 'hex') {
      return colorValue.hex()
    }

    return colorValue[format]().string()
  }

  if (value.type === 'Float') {
    return (
      (value.negative ? '-' : '') +
      value.integer +
      '.' +
      value.fractional +
      (unit ? 'px' : '')
    )
  }

  return value.value
}

function generateCSS(ast, { devMode }) {
  // TODO: include fragments
  const styles = ast.body.filter(node => node.type === 'Style')
  const variants = ast.body.filter(node => node.type === 'Variant')

  return styles.reduce((files, module) => {
    const classes = generateClasses(module.body, variants)

    files[module.name + '.elo.css'] = classes
      .filter(selector => selector.declarations.length > 0)
      .map(selector => {
        const css = stringifyCSS(
          selector.declarations,
          getModuleName(module, devMode) + selector.modifier + selector.pseudo
        )

        if (selector.media) {
          return '@media ' + selector.media + ' {\n' + css + '\n}'
        }

        return css
      })
      .join('\n\n')

    return files
  }, {})
}

function generateClasses(
  nodes,
  variants,
  classes = [],
  modifier = '',
  pseudo = '',
  media = ''
) {
  const base = nodes.filter(node => node.type === 'Declaration')
  const nesting = nodes.filter(node => node.type !== 'Declaration')

  classes.push({
    media,
    pseudo,
    modifier,
    declarations: getStaticDeclarations(base),
  })

  nesting.forEach(nest => {
    if (nest.property.type === 'Identifier') {
      const variant = variants.find(
        variant => variant.name === nest.property.value
      )

      if (variant) {
        if (nest.value.type === 'Identifier') {
          const variation = variant.body.find(
            variant => variant.value === nest.value.value
          )

          if (variation) {
            generateClasses(
              nest.body,
              variants,
              classes,
              modifier + '__' + variant.name + '-' + variation.value,
              pseudo,
              media
            )
          }
        }
      } else {
        // TODO: throw
      }
    }

    if (nest.property.type === 'Variable' && nest.property.environment) {
      if (
        nest.boolean &&
        validPseudoClasses.indexOf(nest.property.value) !== -1
      ) {
        generateClasses(
          nest.body,
          variants,
          classes,
          modifier,
          pseudo + ':' + nest.property.value,
          media
        )
      }

      if (validMediaQueries.indexOf(nest.property.value) !== -1) {
        generateClasses(
          nest.body,
          variants,
          classes,
          modifier,
          pseudo,
          getMediaQuery(nest.value.value, nest.property.value, nest.operator)
        )
      }
    }
  })

  return classes
}

function getStaticDeclarations(declarations) {
  return declarations
    .filter(decl => !decl.dynamic)
    .map(declaration => ({
      property: declaration.property,
      value: generateCSSValue(declaration.value, declaration.property),
    }))
}

var uppercasePattern = /[A-Z]/g
var msPattern = /^ms-/
var cache = {}

function hyphenateProperty(string) {
  return string in cache
    ? cache[string]
    : (cache[string] = string
        .replace(uppercasePattern, '-$&')
        .toLowerCase()
        .replace(msPattern, '-ms-'))
}

function stringifyCSS(declarations, name) {
  return (
    '.' +
    name +
    ' {\n  ' +
    declarations
      .map(decl => hyphenateProperty(decl.property) + ': ' + decl.value)
      .join(';\n  ') +
    '\n' +
    '}'
  )
}

function generateJS(ast, { devMode, dynamicImport }, adapter) {
  // TODO: include fragments
  const styles = ast.body.filter(node => node.type === 'Style')
  const variants = ast.body.filter(node => node.type === 'Variant')

  return styles.reduce((files, module) => {
    const style = generateStyle(module.body)
    const classNameMap = generateClassNameMap(module.body, variants)

    files[module.name + '.elo.js'] = adapter.stringify({
      style,
      moduleName: module.name,
      dynamicImport,
      classNameMap,
      className: '_elo_view ' + getModuleName(module, devMode),
      variants: variants.reduce((flatVariants, variant) => {
        flatVariants[variant.name] = variant.body.map(
          variation => variation.value
        )

        return flatVariants
      }, {}),
    })

    return files
  }, {})
}

function generateClassNameMap(
  nodes,
  variants,
  classes = {},
  variations = {},
  modifier = ''
) {
  const base = nodes.filter(node => node.type === 'Declaration')
  const nesting = nodes.filter(node => node.type !== 'Declaration')

  classes[modifier] = variations

  nesting.forEach(nest => {
    if (nest.property.type === 'Identifier') {
      const variant = variants.find(
        variant => variant.name === nest.property.value
      )

      if (variant) {
        if (nest.value.type === 'Identifier') {
          const variation = variant.body.find(
            variant => variant.value === nest.value.value
          )

          if (variation) {
            generateClassNameMap(
              nest.body,
              variants,
              classes,
              {
                ...variations,
                [variant.name]: variation.value,
              },
              modifier + '__' + variant.name + '-' + variation.value
            )
          }
        }
      } else {
        // TODO: throw
      }
    }
  })

  return classes
}

function generateStyle(nodes) {
  const base = nodes.filter(node => node.type === 'Declaration')
  const nestings = nodes.filter(node => node.type !== 'Declaration')

  const declarations = base
    .filter(decl => decl.dynamic)
    .map(declaration => ({
      property: declaration.property,
      value: declaration.value.value,
    }))

  const nests = nestings
    .map(nest => {
      if (nest.property.type === 'Variable' && nest.property.environment) {
        if (
          nest.boolean &&
          validPseudoClasses.indexOf(nest.property.value) !== -1
        ) {
          return {
            property: ':' + nest.property.value,
            value: generateStyle(nest.body),
          }
        }

        if (validMediaQueries.indexOf(nest.property.value) !== -1) {
          return {
            property: getMediaQuery(
              nest.value.value,
              nest.property.value,
              nest.operator
            ),
            value: generateStyle(nest.body),
          }
        }
      }
    })
    .filter(nesting => nesting && nesting.value.length > 0)

  return [...declarations, ...nests]
}

function getMediaQuery(value, property, operator) {
  const dimension = property.indexOf('Height') !== -1 ? 'height' : 'width'

  if (operator === '=') {
    return (
      '(min-' +
      dimension +
      ': ' +
      value +
      'px) and (max-' +
      dimension +
      ': ' +
      value +
      'px)'
    )
  }

  if (operator === '>') {
    return '(min-' + dimension + ': ' + (value + 1) + 'px)'
  }

  if (operator === '>=') {
    return '(min-' + dimension + ': ' + value + 'px)'
  }

  if (operator === '<=') {
    return '(max-' + dimension + ': ' + value + 'px)'
  }

  if (operator === '<') {
    return '(max-' + dimension + ': ' + (value - 1) + 'px)'
  }
}