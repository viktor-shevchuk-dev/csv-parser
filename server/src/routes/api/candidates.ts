import express from "express";

import ctrl from "../../controllers/candidates";

const router = express.Router();

router.get("/", ctrl.getAll);

export default router;
