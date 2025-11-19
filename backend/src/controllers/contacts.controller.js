import User from "../models/User.js";

// Get user's contacts only
export const getMyContacts = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).populate(
      "contacts",
      "fullName email profilePic"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user.contacts || []);
  } catch (error) {
    console.error("Error in getMyContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Search for users by contact ID, email or name (to add new contacts)
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user._id;

    if (!query || query.trim().length < 2) {
      return res
        .status(400)
        .json({ message: "Search query must be at least 2 characters" });
    }

    // Search by contact ID first (exact match), then by email or full name
    let users = [];

    // Priority 1: Exact contact ID match
    const exactContactIdMatch = await User.findOne({
      contactId: query.trim(),
      _id: { $ne: userId },
    }).select("fullName email profilePic contactId");

    if (exactContactIdMatch) {
      users = [exactContactIdMatch];
    } else {
      // Priority 2: Search by email or full name (case insensitive)
      users = await User.find({
        _id: { $ne: userId }, // Exclude current user
        $or: [
          { email: { $regex: query, $options: "i" } },
          { fullName: { $regex: query, $options: "i" } },
          { contactId: { $regex: query, $options: "i" } },
        ],
      })
        .select("fullName email profilePic contactId")
        .limit(20);
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("Error in searchUsers:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add a user to contacts
export const addContact = async (req, res) => {
  try {
    const userId = req.user._id;
    const { contactId } = req.body;

    if (!contactId) {
      return res.status(400).json({ message: "Contact ID is required" });
    }

    if (userId.toString() === contactId) {
      return res
        .status(400)
        .json({ message: "Cannot add yourself as a contact" });
    }

    // Check if contact exists
    const contactUser = await User.findById(contactId);
    if (!contactUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add contact to current user
    const user = await User.findById(userId);
    if (user.contacts.includes(contactId)) {
      return res.status(400).json({ message: "Contact already added" });
    }

    user.contacts.push(contactId);
    await user.save();

    // Optionally add current user to contact's contacts (mutual)
    if (!contactUser.contacts.includes(userId)) {
      contactUser.contacts.push(userId);
      await contactUser.save();
    }

    // Return the newly added contact info
    const addedContact = await User.findById(contactId).select(
      "fullName email profilePic"
    );

    res.status(200).json({
      message: "Contact added successfully",
      contact: addedContact,
    });
  } catch (error) {
    console.error("Error in addContact:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove a contact
export const removeContact = async (req, res) => {
  try {
    const userId = req.user._id;
    const { contactId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove contact from user's contacts
    user.contacts = user.contacts.filter((id) => id.toString() !== contactId);
    await user.save();

    // Optionally remove user from contact's contacts (mutual)
    const contactUser = await User.findById(contactId);
    if (contactUser) {
      contactUser.contacts = contactUser.contacts.filter(
        (id) => id.toString() !== userId.toString()
      );
      await contactUser.save();
    }

    res.status(200).json({ message: "Contact removed successfully" });
  } catch (error) {
    console.error("Error in removeContact:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Set or update user's contact ID
export const setContactId = async (req, res) => {
  try {
    const userId = req.user._id;
    const { contactId } = req.body;

    if (!contactId || contactId.trim().length < 3) {
      return res
        .status(400)
        .json({ message: "Contact ID must be at least 3 characters" });
    }

    // Validate format: alphanumeric, underscores, and hyphens only
    const validFormat = /^[a-zA-Z0-9_-]+$/;
    if (!validFormat.test(contactId.trim())) {
      return res.status(400).json({
        message:
          "Contact ID can only contain letters, numbers, underscores, and hyphens",
      });
    }

    // Check if contact ID is already taken
    const existingUser = await User.findOne({
      contactId: contactId.trim(),
      _id: { $ne: userId },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "This Contact ID is already taken" });
    }

    // Update user's contact ID
    const user = await User.findByIdAndUpdate(
      userId,
      { contactId: contactId.trim() },
      { new: true }
    ).select("-password");

    res.status(200).json({
      message: "Contact ID set successfully",
      user,
    });
  } catch (error) {
    console.error("Error in setContactId:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Check if contact ID is available
export const checkContactIdAvailability = async (req, res) => {
  try {
    const { contactId } = req.query;
    const userId = req.user._id;

    if (!contactId || contactId.trim().length < 3) {
      return res.status(400).json({
        available: false,
        message: "Contact ID must be at least 3 characters",
      });
    }

    const validFormat = /^[a-zA-Z0-9_-]+$/;
    if (!validFormat.test(contactId.trim())) {
      return res.status(400).json({
        available: false,
        message: "Only letters, numbers, underscores, and hyphens allowed",
      });
    }

    const existingUser = await User.findOne({
      contactId: contactId.trim(),
      _id: { $ne: userId },
    });

    res.status(200).json({
      available: !existingUser,
      message: existingUser
        ? "Contact ID is already taken"
        : "Contact ID is available",
    });
  } catch (error) {
    console.error("Error in checkContactIdAvailability:", error);
    res.status(500).json({ message: "Server error" });
  }
};
