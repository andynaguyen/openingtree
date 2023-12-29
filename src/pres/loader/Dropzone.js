import React from "react";
import { DropzoneArea } from "material-ui-dropzone";

export default class Dropzone extends React.Component {
  handleFileChange(newFiles) {
    this.props.filesChange(newFiles);
  }
  render() {
    return (
      <DropzoneArea
        acceptedFiles={[]}
        dropzoneText={this.props.dropzoneText}
        onChange={this.handleFileChange.bind(this)}
        dropzoneParagraphClass="dropzonetext"
        showFileNames={true}
        useChipsForPreview={true}
        previewChipProps={{ className: "previewChip" }}
        dropzoneClass="dropzone"
        filesLimit={this.props.filesLimit}
        maxFileSize={3000000000000}
      />
    );
  }
}
