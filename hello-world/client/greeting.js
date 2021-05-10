const borsh = require('borsh');

class GreetingAccount {
    counter = 0;
    constructor(fields) {
        if (fields) {
            this.counter = fields.counter;
        }
    }
}

const GreetingSchema = new Map([
    [GreetingAccount, { kind: 'struct', fields: [['counter', 'u32']] }],
]);

const GREETING_SIZE = borsh.serialize(GreetingSchema, new GreetingAccount()).length;


module.exports = {
    GreetingAccount,
    GreetingSchema,
    GREETING_SIZE,
};
