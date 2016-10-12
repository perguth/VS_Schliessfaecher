const choo = require('choo')
const html = require('choo/html')
const sf = require('sheetify')
const localstorage = require('localstorage-down')
const levelup = require('levelup')
const hyperlog = require('hyperlog')
const debug = require('debug')('lockbox')
const moment = require('moment')

const fields = ['name', 'lockerboxID', 'studentID', 'semester']
const db = levelup('lockbox', {db: localstorage})
const app = choo()
const get = query => {
  let result = document.querySelectorAll(query)
  if (result.length !== 1) {
    debug(`Couldn't find exactly one occurence for "${query}"`)
    return ''
  }
  return document.querySelectorAll(query)[0].value
}

app.model({
  state: {
    hyperlog: hyperlog(db),
    lockboxes: []
  },
  reducers: {
    add: (data, state) => {
      data.moment = moment()._d
      return Object.assign(state, {
        lockboxes: [].concat(state.lockboxes, data)
      })
    }
  }
})

const mainView = (state, prev, send) => {
  const reducer = send
  // const effect = send
  let style = sf`
    label {
      display: block;
    }
  `
  return html`
    <main class=${style}>
      <h2>Register lockbox</h2>
      <form>
        <label>
          <span>Lockerbox ID:</span>
          <input type=number class='lockerboxID'>
        </label>
        <label>
          <span>Student name:</span>
          <input type=text placeholder='Name' class='name'>
        </label>
        <label>
          <span>Student ID:</span>
          <input type=text placeholder='Student ID' class='studentID'>
        </label>
        <label>
          <span>Semester:</span>
          <input type=number class='semester'>
        </label>

        <input type=submit value='Add' onclick=${e => {
          let form = {}
          fields.forEach(elem => {
            form[elem] = get('input.' + elem)
          })
          reducer('add', form)
          e.preventDefault()
        }}>
      </form>

      <h2>Overview</h2>
      <ol>
        ${
          state.lockboxes.map(lockbox => {
            return html`<li>
              ${
                fields.map((field, i) => {
                  if (!lockbox[field]) lockbox[field] = ' -'
                  if (i === 0) return html`<b>${lockbox[field]}</b>`
                  return ', ' + lockbox[field]
                })
              }, ${moment(lockbox.moment).format('MMMM Do YYYY, h:mm:ss a')}
            </li>`
          })
        }
      </ol>
    </main>
  `
}

app.router(route => [
  route('/', mainView)
])

const tree = app.start()
document.body.appendChild(tree)
