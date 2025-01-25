import express from "express";

import ctrl from "../../controllers/books";

const router = express.Router();

router.get("/", ctrl.getAll);

export default router;
