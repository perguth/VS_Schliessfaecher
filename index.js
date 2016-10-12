const choo = require('choo')
const html = require('choo/html')
const sf = require('sheetify')
const localstorage = require('localstorage-down')
const levelup = require('levelup')
const hyperlog = require('hyperlog')
const debug = require('debug')('lockbox')
const moment = require('moment')

const fields = ['lockerboxID', 'name', 'studentID', 'semester']
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

const state = {
  log: hyperlog(db, {valueEncoding: 'json'}),
  transactions: []
}

app.model({
  state,
  effects: {
    add: (data, state, send, done) => {
      state.log.heads((err, heads) => {
        if (err) debug(err)
        if (heads.length > 1) throw new Error('handle me')
        data.moment = moment()._d
        state.log.add(
          heads[0] ? [heads[0].key] : null,
          data,
          (err, node) => { if (err) done(err) }
        )
      })
    }
  },
  subscriptions: [
    function subscribeToHyperlogChanges (send, done) {
      var reducer = send
      var changeStream = state.log.createReadStream({live: true})
      changeStream.on('data', node => {
        reducer('addToState', node.value, err => err && done(err))
      })
    }
  ],
  reducers: {
    addToState: (data, state) => {
      console.log('reducers')
      return Object.assign(state, {
        transactions: [].concat(state.transactions, data)
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
          <span>Transaction type</span>
          <select class='transaction_type'>
            <option value=claim>Claim</option>
            <option value=unclaim>Modify</option>
            <option value=unclaim>Unclaim</option>
          </select>
        </label>
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
          form.transactionType = get('select.transaction_type')
          reducer('add', form)
          e.preventDefault()
        }}>
      </form>

      <h2>Transactions</h2>
      <ol>
        ${
          state.transactions.map(lockbox => {
            return html`<li>
              <b>${lockbox.transactionType}</b>:
              <pre>{${
                fields.map((field, i) => {
                  if (!lockbox[field]) lockbox[field] = `-`
                  if (i === 0) return html`<b>${field}: ${lockbox[field]}</b>`
                  return `,\n${field}: ${lockbox[field]}`
                })
              },\n${`moment: ` + moment(lockbox.moment).format('MMMM Do YYYY, h:mm:ss a')}}
            </pre></li>`
          })
        }
      </ol>
    </main>
  `
}

app.router(route => [
  route('/', mainView)
])

debug('app start')
const tree = app.start()
document.body.appendChild(tree)
