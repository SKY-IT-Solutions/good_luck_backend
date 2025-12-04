import mongoose from "mongoose";
import { User } from "../../models/auth/user.model.js";
import { LocalService } from "../../models/local services/localservice.model.js";
import { LocalServiceCategory } from "../../models/local services/localserviceCategory.model.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Create a Local Service with Subscription Check
export const createLocalService = asyncHandler(async (req, res, next) => {
  try {
    const {
      userId,
      category,
      image,
      contact,
      isAvailable,
      city,
      state,
      pinCode,
      address,
    } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!userId) missingFields.push("userId");
    if (!category) missingFields.push("category");
    if (!image) missingFields.push("image");
    if (!contact) missingFields.push("contact");
    if (!city) missingFields.push("city");
    if (!state) missingFields.push("state");
    if (!pinCode) missingFields.push("pinCode");
    if (!address) missingFields.push("address");

    if (missingFields.length > 0) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            `Missing required fields: ${missingFields.join(", ")}`
          )
        );
    }

    // Validate PIN code format
    const pinCodeRegex = /^[1-9][0-9]{5}$/;
    if (!pinCodeRegex.test(pinCode)) {
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, "Please enter a valid 6-digit PIN code")
        );
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(new ApiResponse(404, null, "User not found"));
    }

    // Find the category
    const serviceCategory = await LocalServiceCategory.findById(category);
    if (!serviceCategory) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Category not found"));
    }

    // Check subscription
    if (!user.localSubscription || !user.localSubscription.isSubscribed) {
      return res
        .status(403)
        .json(
          new ApiResponse(
            403,
            null,
            "User does not have an active local service subscription"
          )
        );
    }

    // Create and save new service
    const newService = new LocalService({
      userId,
      authId: user.authId,
      category,
      image,
      contact,
      city,
      state,
      pinCode,
      address,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
    });
    await newService.save();

    return res
      .status(201)
      .json(
        new ApiResponse(201, newService, "Local service created successfully")
      );
  } catch (error) {
    next(error);
  }
});

// Get All Local Services with filtering and search
export const getAllLocalServices = asyncHandler(async (req, res, next) => {
  try {
    const {
      category,
      city,
      state,
      pinCode,
      search,
      isAvailable,
      page = 1,
      limit = 10,
    } = req.query;

    // Build filter object
    const filter = {};

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      filter.category = category;
    }

    if (city) {
      filter.city = { $regex: city, $options: "i" };
    }

    if (state) {
      filter.state = { $regex: state, $options: "i" };
    }

    if (pinCode) {
      filter.pinCode = pinCode;
    }

    if (isAvailable !== undefined) {
      filter.isAvailable = isAvailable === "true";
    }

    // Search across multiple fields
    if (search) {
      filter.$or = [
        { address: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { state: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const services = await LocalService.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalCount = await LocalService.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    if (!services.length) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { services: [], totalCount, totalPages, currentPage: pageNum },
            "No local services found"
          )
        );
    }

    res.status(200).json(
      new ApiResponse(
        200,
        {
          services,
          totalCount,
          totalPages,
          currentPage: pageNum,
        },
        "Local services fetched successfully"
      )
    );
  } catch (error) {
    next(error);
  }
});

// Get Local Service by ID
export const getLocalServiceById = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await LocalService.findById(id).populate(
      "category",
      "name"
    );

    if (!service) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Local service not found"));
    }

    res
      .status(200)
      .json(
        new ApiResponse(200, service, "Local service fetched successfully")
      );
  } catch (error) {
    next(error);
  }
});

// Update Local Service by ID
export const updateLocalService = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      category,
      image,
      contact,
      isAvailable,
      city,
      state,
      pinCode,
      address,
    } = req.body;

    const existingService = await LocalService.findById(id);
    if (!existingService) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Local service not found"));
    }

    // Validate PIN code format if provided
    if (pinCode) {
      const pinCodeRegex = /^[1-9][0-9]{5}$/;
      if (!pinCodeRegex.test(pinCode)) {
        return res
          .status(400)
          .json(
            new ApiResponse(400, null, "Please enter a valid 6-digit PIN code")
          );
      }
    }

    // Update fields if provided
    if (category) existingService.category = category;
    if (image) existingService.image = image;
    if (contact) existingService.contact = contact;
    if (isAvailable !== undefined) existingService.isAvailable = isAvailable;
    if (city) existingService.city = city;
    if (state) existingService.state = state;
    if (pinCode) existingService.pinCode = pinCode;
    if (address) existingService.address = address;

    await existingService.save();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          existingService,
          "Local service updated successfully"
        )
      );
  } catch (error) {
    next(error);
  }
});

// Get Local Services by Category ID with location filtering
export const getLocalServicesByCategory = asyncHandler(
  async (req, res, next) => {
    try {
      const { categoryId } = req.params;
      const { city, state, pinCode } = req.query;

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res
          .status(400)
          .json(new ApiResponse(400, null, "Invalid category ID"));
      }

      // Build location filter
      const locationFilter = { category: categoryId };

      if (city) {
        locationFilter.city = { $regex: city, $options: "i" };
      }

      if (state) {
        locationFilter.state = { $regex: state, $options: "i" };
      }

      if (pinCode) {
        locationFilter.pinCode = pinCode;
      }

      const services = await LocalService.find(locationFilter)
        .populate("category", "name")
        .sort({ createdAt: -1 });

      if (!services.length) {
        return res
          .status(200)
          .json(
            new ApiResponse(
              200,
              [],
              "No local services found for this category and location"
            )
          );
      }

      res
        .status(200)
        .json(
          new ApiResponse(200, services, "Local services fetched successfully")
        );
    } catch (error) {
      next(error);
    }
  }
);

// Search Local Services by location
export const searchLocalServicesByLocation = asyncHandler(
  async (req, res, next) => {
    try {
      const { city, state, pinCode, search } = req.query;

      const filter = {};

      if (city) {
        filter.city = { $regex: city, $options: "i" };
      }

      if (state) {
        filter.state = { $regex: state, $options: "i" };
      }

      if (pinCode) {
        filter.pinCode = pinCode;
      }

      // General search across location fields
      if (search) {
        filter.$or = [
          { city: { $regex: search, $options: "i" } },
          { state: { $regex: search, $options: "i" } },
          { address: { $regex: search, $options: "i" } },
          { pinCode: { $regex: search, $options: "i" } },
        ];
      }

      const services = await LocalService.find(filter)
        .populate("category", "name")
        .sort({ createdAt: -1 });

      if (!services.length) {
        return res
          .status(200)
          .json(
            new ApiResponse(
              200,
              [],
              "No local services found for this location"
            )
          );
      }

      res
        .status(200)
        .json(
          new ApiResponse(200, services, "Local services fetched successfully")
        );
    } catch (error) {
      next(error);
    }
  }
);

// Get services by city
export const getLocalServicesByCity = asyncHandler(async (req, res, next) => {
  try {
    const { city } = req.params;
    const { category } = req.query;

    const filter = { city: { $regex: city, $options: "i" } };

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      filter.category = category;
    }

    const services = await LocalService.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 });

    if (!services.length) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], `No local services found in ${city}`));
    }

    res
      .status(200)
      .json(
        new ApiResponse(200, services, "Local services fetched successfully")
      );
  } catch (error) {
    next(error);
  }
});

// Get services by state
export const getLocalServicesByState = asyncHandler(async (req, res, next) => {
  try {
    const { state } = req.params;
    const { category } = req.query;

    const filter = { state: { $regex: state, $options: "i" } };

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      filter.category = category;
    }

    const services = await LocalService.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 });

    if (!services.length) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], `No local services found in ${state}`));
    }

    res
      .status(200)
      .json(
        new ApiResponse(200, services, "Local services fetched successfully")
      );
  } catch (error) {
    next(error);
  }
});

// Delete Local Service by ID
export const deleteLocalService = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await LocalService.findByIdAndDelete(id);

    if (!service) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Local service not found"));
    }

    res
      .status(200)
      .json(new ApiResponse(200, null, "Local service deleted successfully"));
  } catch (error) {
    next(error);
  }
});

// Get Local Services with City, State, Address Filtering
export const filterLocalServices = asyncHandler(async (req, res, next) => {
  try {
    const { city, state, address, page = 1, limit = 10 } = req.query;

    // Build filter object
    const filter = {};

    // City filter (case insensitive)
    if (city) {
      filter.city = { $regex: city, $options: "i" };
    }

    // State filter (case insensitive)
    if (state) {
      filter.state = { $regex: state, $options: "i" };
    }

    // Address filter (case insensitive)
    if (address) {
      filter.address = { $regex: address, $options: "i" };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Find services with filters
    const services = await LocalService.find(filter)
      .populate("category", "name")
      .populate("userId", "firstName lastName email") // User details
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalCount = await LocalService.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Response
    res.status(200).json(
      new ApiResponse(
        200,
        {
          services,
          totalCount,
          totalPages,
          currentPage: pageNum,
          filters: { city, state, address },
        },
        "Local services filtered successfully"
      )
    );
  } catch (error) {
    next(error);
  }
});
