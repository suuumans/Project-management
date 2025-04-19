
import app from "./app.js";
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import cors from "cors";

app.use(cors());

const PORT = process.env.PORT || 3000;

dotenv.config({
    path: "./.env"
});

connectDB()
    .then(() => {
        app.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        })
    })
    .catch((err) => {
        console.log("MongoDB connection error:", err)
        process.exit(1);
    });


// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });