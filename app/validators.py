from pydantic import BaseModel, Field, ConfigDict, field_validator


class BaseValidator(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MosaicRefreshSchemeRequest(BaseValidator):
    image_hash: str = Field(
        min_length=64,
        max_length=64,
        examples=['6fcc1d052d571177bb73ac9059063d5e485d0f43477776a287d389782c4dca37'],
    )
    divider: int = Field(ge=2, le=50, examples=[15])
    n_colors: int = Field(ge=2, le=50, examples=[15])
