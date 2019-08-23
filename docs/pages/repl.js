import React, { useState, useEffect } from 'react'
import { parse } from '@elodin/parser'
import { createGenerator as createJsGenerator } from '@elodin/generator-css-in-js'
import { createGenerator as createReasonGenerator } from '@elodin/generator-reason'
import { format } from '@elodin/format'

// const generate = createJsGenerator({
//   adapter: 'fela',
// })

const generate = createReasonGenerator()

export default () => {
  const [code, setCode] = useState('')
  const [out, setOut] = useState({})
  const [ast, setAst] = useState({})
  const [errors, setErrors] = useState([])

  useEffect(() => {
    if (!code && localStorage.getItem('code') !== null) {
      setCode(localStorage.getItem('code'))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('code', code)
  }, [code])

  useEffect(() => {
    try {
      const parsed = parse(code)

      if (parsed.errors.length === 0) {
        setAst(parsed.ast)
        setOut(generate(parsed.ast))
      } else {
        setOut({})
      }

      setErrors(parsed.errors)
    } catch (e) {
      throw new Error(e)
    }
  }, [code])

  return (
    <div style={{ overflow: 'auto' }}>
      <textarea
        value={code}
        onChange={e => setCode(e.target.value)}
        style={{ height: 200, width: 400 }}
      />
      <div>
        <button
          onClick={() => {
            try {
              const formatted = format(code)
              setCode(formatted.code)
              setErrors(formatted.errors)
            } catch (e) {
              throw new Error(e)
            }
          }}>
          Format
        </button>

        <div style={{ backgroundColor: 'rgba(250, 0,0, 0.2)' }}>
          <b>Errors</b>
          {errors.map(error => (
            <div>{JSON.stringify(error)}</div>
          ))}
        </div>
        <details>
          <summary>AST</summary>
          <pre>{JSON.stringify(ast, null, 2)}</pre>
        </details>
        {Object.keys(out).map(filename => (
          <div>
            <b>{filename}</b>
            <pre style={{ backgroundColor: 'rgb(250, 250, 250)' }}>
              <code dangerouslySetInnerHTML={{ __html: out[filename] }} />
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
