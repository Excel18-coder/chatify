import express from "express";
import {
  addContact,
  checkContactIdAvailability,
  getMyContacts,
  removeContact,
  searchUsers,
  setContactId,
} from "../controllers/contacts.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, getMyContacts);
router.get("/search", protectRoute, searchUsers);
router.get("/check-id", protectRoute, checkContactIdAvailability);
router.post("/add", protectRoute, addContact);
router.post("/set-id", protectRoute, setContactId);
router.delete("/:contactId", protectRoute, removeContact);

export default router;
