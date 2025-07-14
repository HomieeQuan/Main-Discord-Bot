const mongoose = require('mongoose')

const connectdb = async () => {
    try{
        const connect = await mongoose.connect(process.env.URI)
        console.log(`Database connected:
           name: ${connect.connection.name}
           host: ${connect.connection.host}
            `)
    }catch (err) {
        console.log(err)
        process.exit(1)
    }
}
module.exports = connectdb