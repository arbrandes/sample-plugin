import React, { useState, useEffect } from "react";
import { getAuthenticatedHttpClient, getSiteConfig } from "@openedx/frontend-base";
import {
  Card,
  Container,
  Row,
  Col,
  Badge,
  Collapsible,
  Button,
  Spinner,
  Dropdown,
  IconButton,
  Icon,
} from "@openedx/paragon";
import { Archive, Unarchive, MoreVert } from "@openedx/paragon/icons";

const CourseList = ({ courseListData }) => {
  const [archivedCourses, setArchivedCourses] = useState(new Set());
  const [loadingStates, setLoadingStates] = useState(new Map());

  useEffect(() => {
    const fetchArchivedCourses = async () => {
      try {
        const client = getAuthenticatedHttpClient();
        const lmsBaseUrl = getSiteConfig().lmsBaseUrl;

        const response = await client.get(
          `${lmsBaseUrl}/sample-plugin/api/v1/course-archive-status/`,
          {
            params: { is_archived: true },
          },
        );

        const archivedCourseIds = new Set(
          response.data.results.map((item) => item.course_id),
        );
        setArchivedCourses(archivedCourseIds);
      } catch (error) {
        console.error("Failed to fetch archived courses:", error);
      }
    };

    fetchArchivedCourses();
  }, []);

  if (!courseListData || !courseListData.visibleList) {
    return <div>Loading courses...</div>;
  }

  const courses = courseListData.visibleList;

  const activeCourses = courses.filter((courseData) => {
    const courseId = courseData.courseRun?.courseId;
    return !archivedCourses.has(courseId);
  });

  const archivedCoursesList = courses.filter((courseData) => {
    const courseId = courseData.courseRun?.courseId;
    return archivedCourses.has(courseId);
  });

  const handleArchiveToggle = async (courseId, isCurrentlyArchived) => {
    setLoadingStates((prev) => new Map(prev).set(courseId, true));

    try {
      const client = getAuthenticatedHttpClient();
      const lmsBaseUrl = getSiteConfig().lmsBaseUrl;
      const url = `${lmsBaseUrl}/sample-plugin/api/v1/course-archive-status/`;

      const listResponse = await client.get(url, {
        params: { course_id: courseId },
      });
      const existingRecord = listResponse.data.results[0];

      if (isCurrentlyArchived) {
        if (existingRecord) {
          await client.patch(`${url}${existingRecord.id}/`, {
            course_id: courseId,
            is_archived: false,
          });
        }
        setArchivedCourses((prev) => {
          const newSet = new Set(prev);
          newSet.delete(courseId);
          return newSet;
        });
      } else {
        if (existingRecord) {
          await client.patch(`${url}${existingRecord.id}/`, {
            is_archived: true,
          });
        } else {
          await client.post(url, {
            course_id: courseId,
            is_archived: true,
          });
        }
        setArchivedCourses((prev) => new Set(prev).add(courseId));
      }
    } catch (error) {
      console.error(
        `Failed to ${isCurrentlyArchived ? "unarchive" : "archive"} course:`,
        error,
      );
    } finally {
      setLoadingStates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(courseId);
        return newMap;
      });
    }
  };

  const renderCourse = (courseData, isArchived = false) => {
    const courseId = courseData.courseRun?.courseId;
    const isLoading = loadingStates.get(courseId);

    return (
      <Col
        key={courseData.cardId}
        xs={12}
        sm={6}
        md={4}
        lg={3}
        className="mb-4"
      >
        <Card>
          <a href={courseData.courseRun?.homeUrl || '#'}>
            <Card.ImageCap
              src={getSiteConfig().lmsBaseUrl + courseData.course.bannerImgSrc}
              alt={courseData.course.courseName}
            />
          </a>
          <Card.Header
            title={
              <a href={courseData.courseRun?.homeUrl || '#'}>
                {courseData.course.courseName}
              </a>
            }
            subtitle={courseData.course.courseNumber}
            actions={
              <>
                {isArchived && <Badge variant="secondary" className="me-2">Archived</Badge>}
                <Dropdown>
                  <Dropdown.Toggle
                    id={`course-menu-${courseData.cardId}`}
                    as={IconButton}
                    src={MoreVert}
                    iconAs={Icon}
                    variant="primary"
                    aria-label="More actions"
                  />
                  <Dropdown.Menu>
                    {courseData.course.socialShareUrl && (
                      <Dropdown.Item
                        href={courseData.course.socialShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Course About Page
                      </Dropdown.Item>
                    )}
                  </Dropdown.Menu>
                </Dropdown>
              </>
            }
          />
          <Card.Section>
            {courseData.course.shortDescription && (
              <p className="text-muted small">
                {courseData.course.shortDescription}
              </p>
            )}
          </Card.Section>
          <Card.Footer>
            <Button
              variant={isArchived ? "outline-primary" : "outline-secondary"}
              size="sm"
              disabled={isLoading}
              onClick={() => handleArchiveToggle(courseId, isArchived)}
              iconBefore={
                isLoading ? Spinner : isArchived ? Unarchive : Archive
              }
            >
              {isLoading
                ? "Processing..."
                : isArchived
                  ? "Unarchive"
                  : "Archive"}
            </Button>
          </Card.Footer>
        </Card>
      </Col>
    );
  };

  return (
    <Container fluid>
      <Row>
        {activeCourses.map((courseData) => renderCourse(courseData, false))}
      </Row>

      {archivedCoursesList.length > 0 && (
        <div className="mt-5">
          <Collapsible
            title={`Archived Courses (${archivedCoursesList.length})`}
            defaultOpen={false}
          >
            <Row>
              {archivedCoursesList.map((courseData) =>
                renderCourse(courseData, true),
              )}
            </Row>
          </Collapsible>
        </div>
      )}
    </Container>
  );
};

export default CourseList;
