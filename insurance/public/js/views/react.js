// Note: This script is as of yet completely untested.
// Note: This shouldn't be needed?
'use strict';

import 'bootstrap/scss/bootstrap.scss';
import React, {Component} from 'react';
import ReactTable from 'react-table';
import 'react-table/react-table.css';
// Note: I need to check is these are a correct replacement for require.
import assert from 'assert';
import EventEmitter from 'events';
import classnames from 'classnames';

// Note: This is a dummy provider for formatting handlers (localization).
const Format = (toString => {
    integer: toString,
    // Note: Currency needed to be plugged into a localization lib for this.
    money: toString,
    // Note: Should most likely take formatting and timezone from locale.
    // Note: Could use something such as moment.
    datetime: toString
})(value => value.toLocaleString());

// Note: This is a dummy API provider.
const Api = (() => {
    const
        data = Object.create(null),
        indexById = Object.create(null),
        cloneQuote = quote => Object.assign(Object.create(null), quote)
        hydrateQuote = (scope, quote) => {
            for(const [key, meta] of Object.entries(Meta)) {
                const isInScope = meta.scopes.has(scope);

                if(isInScope && 'generator' in meta) {
                    quote[key] = meta.generator();
                }
            }
        };

    return {
        list: () => new Promise.resolve(data.map(clone)),
        referenceExists: reference => new Promise.resolve(data.find(quote => quote.reference === reference) !== undefined),
        create: (crsf, quote) => new Promise(resolve => {
            assert(crsf === Crsf);
            quote = cloneQuote(quote);
            hydrateQuote('create', quote);
            data.push(indexById[quote.id] = quote);
            resolve();
            Api.event.emit('update');
        }),
        edit: (crsf, quote) => new Promise(resolve => {
            assert(crsf === Crsf);
            Object.assign(indexById[quote.id], quote);
            resolve();
            Api.event.emit('update');
        }),
        event: new EventEmitter()
    };
})();

const Meta = {
    id: {label: 'Id', generator: (id => () => id++)(1), scopes: new Set(['create']), formatter: Format.integer},
    reference: {label: 'Reference', type: 'string', min: 1, max: 255, unique: Api.referenceExists, scopes: new Set(['create'])},
    amount: {label: 'Amount (CUR)', type: 'decimal', scale: 12, precision: 2, min: 0.01, scopes: new Set(['create', 'edit']), formatter: Format.money},
    createdAt: {label: 'Date Created', generator: () => new Date(), scopes: new Set(['create']), formatter: Format.datetime}
};

// Note: The best place to put this might be in cookies?
const Crsf = Math.random();

// Note: Might want to consider separation of sync and async (sync first then async usually is a good idea.
const Validate = {
    async all(scope, quote) {
        for(const key in quote) {
            assert(key in Meta);
        }

        for(const [key, meta] of Object.entries(Meta)) {
            const isInScope = meta.scopes.has(scope);

            if(!isInScope || 'generator' in meta) {
                assert(!(key in quote));
                continue;
            }

            // Note: An alternative might be to race the validators for one to fail, etc. This could be parallel but isn't.
            // Note: Efficiency, writes even when no change.
            quote[key] = await Validate.single(meta, quote[key]);
        }
    },
    async single(meta, value) {
        const value = quote[key];

        if('unique' in meta) {
            assert(await meta.unique(value));
        }

        switch(meta.type) {
            case 'string':
                assert(typeof value === 'string');
                // Note: Don't forget about charset (back might not match front).
                assert(value.length >= meta.min);
                assert(value.length <= meta.max);
                break;
            case 'decimal':
                // Note: This really wants a real decimal number library matched with backend.
                assert(typeof value === 'numeric');
                assert(value >= meta.min);
                assert(value.toFixed(0).length <= meta.scale - meta.precision);
                // Note: Hidden loss of precision.
                value = value.toFixed(meta.precision);
                break;
            default:
                assert(false);
        }

        return value;
    }
}

class App extends Component {
    construct(props) {
        super(props);
        this.state = {data: [], selected: null};
        this.updateData = this.updateData.bind(this);
        this.updateData();
        // Note: No run once, etc.
        // Note: Reloading the entire table might not always be efficient.
        // Note: Not disabling while this happens or giving of it loading.
        Api.event.on('update', this.updateData);
    }

    async updateData() {
        // Note: API layer/module needs to be implemented.
        // Note: This method of loading isn't exploiting any ability the table library offers such as pagnination.
        this.setState({data: await Api.quote.list()});
    }

    componentWillUnmount() {
        // Note: This doesn't cancel an ongoing request!
        Api.event.off('update', this.updateData);
    }

    render() {
        const
            {data} = this.state, columns = [], form = <Form/>,
            getTdProps = (state, rowInfo) => {
                onClick: () => this.setState(state => {
                    data: state.data,
                    selected: state.selected === null ? rowInfo.row._original.id : null
                })
            };

        // Note: This doesn't need to be generated every time!
        for(const [accessor, meta] of Object.entries(Meta)) {
            const column = {Header: meta.label, accessor};

            if('formatter' in meta) {
                column.Cell = meta.formatter;
            }

            columns.push(column);
        }

        if(this.state.selected === null) {
            form.setToCreate();
        } else {
            form.setToEdit(this.state.data.find(quote => quote.id === this.state.selected));
        }

        return (
            <div>
                <ReactTable {...{data, columns, getTdProps}}/>
            </div>
            <div>
                {form}
            </div>
        );
    }
}

class Form extends Component {
    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.state = {};
        this.setToCreate();
    }

    setToEdit(quote) {
        this.setState({scope: 'edit', quote});
    }

    setToCreate() {
        this.setState({scope: 'create', Object.create(null)});
    }

    handleSubmit(event) {
        Api[scope](Crsf, state.quote);
        event.preventDefault();
    }

    render() {
        const inputs = [];

        for(const key, meta of Meta) {
            if(!meta.scope.has(this.state.scope)) {
                continue;
            }

            const props = {};
            let input;

            if(key in state.quote) {
                props.value = state.quote[key];
            }

            switch(meta.type) {
                case 'string':
                    props.type = 'text';
                    props.maxlength = meta.max;
                    break;
                case 'decimal':
                    props.type = 'number';
                    props.step = meta.precision === 0 ? 1 : 1 / Math.pow(10, meta.precision);
                    props.min = meta.min;
                    props.max = Math.pow(10, meta.scale - meta.precision) - props.step;
                    break;
                default:
                    assert(false);
            }

            props.onChange = e => this.setState(state => {state.scope, Object.assign(Object.create(null), state.quote, {[key]: input.value})});
            input = <input {...props}/>;
            // Note: No localisation for punctuation.
            inputs.push(<label>{meta.label}: {input}</label>);
        }

        valid = 

        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    {inputs}
                    <input type="submit"/>
                </form>
            </div>
        );
    }
}