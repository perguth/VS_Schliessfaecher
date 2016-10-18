const choo = require('choo')
const html = require('choo/html')
const sf = require('sheetify')
const localstorage = require('localstorage-down')
const levelup = require('levelup')
const hyperlog = require('hyperlog')
const debug = require('debug')('lockbox')
const moment = require('moment')

const fields = ['boxID', 'building', 'studentName', 'studentID', 'semester']
const db = levelup('lockbox', {db: localstorage})
const app = choo()
const getValueOf = query => {
  let result = document.querySelectorAll(query)
  if (result.length !== 1) {
    debug(`Couldn't find exactly one occurence for "${query}"`)
    return ''
  }
  return document.querySelectorAll(query)[0].value
}

const state = {
  log: hyperlog(db, {valueEncoding: 'json'}),
  transactions: [],
  lockboxes: {ab: [], nb: []}
}
window.state = state

app.model({
  state,
  effects: {
    add: (data, state, send, done) => {
      let reducer = send
      console.log(data, state, send)
      // data = {building, boxID, student}
      console.assert(data && data.building && data.boxID && data.studentID && data.semester, data)

      state.log.heads((err, heads) => {
        if (err) debug(err)
        let head = heads.find(head => head.value.building === data.building && head.value.boxID === data.boxID)
        if (!head) head = {key: null}

        data.moment = moment()._d
        state.log.add(head.key, data, (err, node) => {
          if (err) {
            done(err)
            return
          }
          reducer('updateLockboxState', data, err => err && done(err))
        })
      })
    }
  },
  subscriptions: [
    function subscribeToHyperlogChanges (send, done) {
      var reducer = send
      var changeStream = state.log.createReadStream({live: true})
      changeStream.on('data', node => {
        reducer('updateLockboxState', node.value, err => err && done(err))
      })
    }
  ],
  reducers: {
    updateLockboxState: (data, state) => {
      state.lockboxes[data.building][data.boxID] = data
      return state
    }
  }
})

const mainView = (state, prev, send) => {
  // const reducer = send
  const effect = send
  // const effect = send
  let style = sf`
    label {
      display: block;
    }
  `
  let sendForm = e => {
    let data = {}
    fields.forEach(field => {
      data[field] = getValueOf('input.' + field)
    })
    data.transactionType = getValueOf('select.transaction_type')
    data.building = getValueOf('select.building')
    console.assert(data && data.building && data.boxID && data.studentID && data.semester)

    effect('add', data)
    e.preventDefault()
  }

  return html`<main class=${style}>
    <h2>Register lockbox</h2>
    <form>
      <label>
        <span>Transaction type</span>
        <select class='transaction_type'>
          <option value='claim'>Claim</option>
          <option value='unclaim'>Modify</option>
          <option value='unclaim'>Unclaim</option>
        </select>
      </label>
      <label>
        <span>Building</span>
        <select class='building'>
          <option value='ab'>Altbau</option>
          <option value='nb'>Neubau</option>
        </select>
      </label>
      <label>
        <span>Lockerbox ID:</span>
        <input type=number class='boxID'>
      </label>
      <label>
        <span>Student name:</span>
        <input type=text placeholder='Name' class='studentName'>
      </label>
      <label>
        <span>Student ID:</span>
        <input type=text placeholder='Student ID' class='studentID'>
      </label>
      <label>
        <span>Semester:</span>
        <input type=number class='semester'>
      </label>

      <input type=submit value='Add' onclick=${sendForm}>
    </form>

    <h2>State of lockboxes</h2>
    ${['ab', 'nb'].map(building => html`<section>
      <h2>${building}</h2>
      <ol>
        ${state.lockboxes[building].map(box => html`<div>
          <span>#<b>${box.boxID}</b>:</span>
          <span>${box.studentName}, ${box.studentID}</span>
        </div>`)}
      </ol>
    </section>`)}
  </main>`
}

app.router(route => [
  route('/', mainView)
])

debug('app start')
const tree = app.start()
document.body.appendChild(tree)
