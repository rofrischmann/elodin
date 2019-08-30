import Parser from '../Parser'

describe('Parsing elodin syntax', () => {
  it('should correctly parse styles', () => {
    const file = `
view Button {
  backgroundColor: red
  borderColor: rgb(255 255 255)
  paddingLeft: 15
  marginTop: 1.2
  borderWidth: $width
  __animationName: keyframe
}`

    const parser = new Parser()

    expect(parser.parse(file)).toMatchSnapshot()
  })

  it('should correctly parse multiple styles', () => {
    const file = `
view Button {
  backgroundColor: red
  paddingLeft: 10
}

text Label {
  lineHeight: 2
}`

    const parser = new Parser()

    expect(parser.parse(file)).toMatchSnapshot()
  })

  it('should correctly parse conditionals', () => {
    const file = `
    variant Type = {
      Dark
      Light
    }

view Button {
  backgroundColor: red

  [Type=Primary] {
    color: red
  }
}`

    const parser = new Parser()

    expect(parser.parse(file)).toMatchSnapshot()
  })

  it('should correctly parse fragments', () => {
    const file = `
fragment Flex {
  flexDirection: row
  alignSelf: stretch
  flexGrow: 0
  flexShrink: 1
  flexBasis: auto
}`

    const parser = new Parser()

    expect(parser.parse(file)).toMatchSnapshot()
  })

  it('should correctly parse env condition', () => {
    const file = `
view Button {
  [@hover] {
    color: red
  }

  [@minWidth=320] {
    color: blue
    [@hover] {
      color: green
    }
  }
}`

    const parser = new Parser()

    expect(parser.parse(file)).toMatchSnapshot()
  })
})
